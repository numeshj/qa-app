import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions, Secret } from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { env } from '../config/env';
import { z } from 'zod';
import { AuthPayload, requireAuth } from '../middlewares/auth';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid credentials', details: parsed.error.flatten().fieldErrors }});
  }
  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email }, include: { roles: { include: { role: true } } } });
  if (!user || !user.isActive) return res.status(400).json({ success: false, error: { code: 'INVALID_LOGIN', message: 'Invalid email or password' }});
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(400).json({ success: false, error: { code: 'INVALID_LOGIN', message: 'Invalid email or password' }});
  const roles = user.roles.map(r => r.role.name);
  const accessPayload: AuthPayload = { userId: user.id, roles };
  const accessOpts: SignOptions = { expiresIn: env.ACCESS_TOKEN_TTL as any };
  const refreshOpts: SignOptions = { expiresIn: env.REFRESH_TOKEN_TTL as any };
  const accessToken = jwt.sign(accessPayload, env.JWT_ACCESS_SECRET as Secret, accessOpts);
  const refreshToken = jwt.sign({ userId: user.id }, env.JWT_REFRESH_SECRET as Secret, refreshOpts);
  // store refresh session (hash minimal)
  await prisma.userSession.create({ data: { userId: user.id, refreshTokenHash: refreshToken, expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7) } });
  res.json({ success: true, data: { accessToken, refreshToken, user: { id: user.id, email: user.email, roles } } });
});

const refreshSchema = z.object({ refreshToken: z.string() });

router.post('/refresh', async (req, res) => {
  const parsed = refreshSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid refresh', details: parsed.error.flatten().fieldErrors }});
  try {
    const payload = jwt.verify(parsed.data.refreshToken, env.JWT_REFRESH_SECRET) as any;
    const session = await prisma.userSession.findFirst({ where: { refreshTokenHash: parsed.data.refreshToken, revokedAt: null } });
    if (!session) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Session not found' }});
    const user = await prisma.user.findUnique({ where: { id: payload.userId }, include: { roles: { include: { role: true } } } });
    if (!user) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'User missing' }});
    const roles = user.roles.map(r => r.role.name);
  const newAccess = jwt.sign({ userId: user.id, roles }, env.JWT_ACCESS_SECRET as Secret, { expiresIn: env.ACCESS_TOKEN_TTL as any });
    return res.json({ success: true, data: { accessToken: newAccess } });
  } catch {
    return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid refresh token' }});
  }
});

const logoutSchema = z.object({ refreshToken: z.string() });
router.post('/logout', async (req, res) => {
  const parsed = logoutSchema.safeParse(req.body);
  if (parsed.success) {
    await prisma.userSession.updateMany({ where: { refreshTokenHash: parsed.data.refreshToken }, data: { revokedAt: new Date() } });
  }
  res.json({ success: true, data: { loggedOut: true } });
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.auth!.userId }, include: { roles: { include: { role: true } } } });
    if (!user) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
    const roles = user.roles.map(r => r.role.name);
    return res.json({ success: true, data: { id: user.id, email: user.email, roles } });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: { code: 'ME_ERROR', message: 'Could not load user' } });
  }
});

export default router;

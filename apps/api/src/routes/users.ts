import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, requireRoles } from '../middlewares/auth';
import { z } from 'zod';
import bcrypt from 'bcryptjs';

const router = Router();

const createUserSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  password: z.string().min(6),
  roles: z.array(z.string()).default([])
});

router.get('/', requireAuth, requireRoles('Admin'), async (_req: Request, res: Response) => {
  const users = await prisma.user.findMany({ include: { roles: { include: { role: true } } } });
  res.json({ success: true, data: users.map(u => ({ id: u.id, email: u.email, firstName: u.firstName, lastName: u.lastName, roles: u.roles.map(r => r.role.name) })) });
});

router.post('/', requireAuth, requireRoles('Admin'), async (req: Request, res: Response) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid', details: parsed.error.flatten().fieldErrors } });
  const { email, firstName, lastName, password, roles } = parsed.data;
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({ data: { email, firstName, lastName, passwordHash } });
  if (roles.length) {
    const roleRecords = await prisma.role.findMany({ where: { name: { in: roles } } });
    await prisma.userRole.createMany({ data: roleRecords.map(r => ({ userId: user.id, roleId: r.id })), skipDuplicates: true });
  }
  res.status(201).json({ success: true, data: { id: user.id } });
});

export default router;

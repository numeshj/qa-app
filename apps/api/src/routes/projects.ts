import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middlewares/auth';
import { z } from 'zod';

const router = Router();

const projectSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(['active','completed','on_hold']).optional()
});

router.get('/', requireAuth, async (_req: Request, res: Response) => {
  const list = await prisma.project.findMany({ take: 50, orderBy: { createdAt: 'desc' } });
  res.json({ success: true, data: list });
});

router.post('/', requireAuth, async (req: Request, res: Response) => {
  const parsed = projectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid', details: parsed.error.flatten().fieldErrors } });
  const project = await prisma.project.create({ data: parsed.data });
  res.status(201).json({ success: true, data: project });
});

router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } });
  res.json({ success: true, data: project });
});

router.put('/:id', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const parsed = projectSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid', details: parsed.error.flatten().fieldErrors } });
  try {
    const updated = await prisma.project.update({ where: { id }, data: parsed.data });
    res.json({ success: true, data: updated });
  } catch {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } });
  }
});

export default router;

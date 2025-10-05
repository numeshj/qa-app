import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middlewares/auth';
import { recordAuditLog } from '../utils/audit';
import { z } from 'zod';

const router = Router();

const projectStatusOptions = ['ongoing', 'completed', 'yet_to_start', 'other'] as const;

const projectSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(projectStatusOptions).optional()
});

router.get('/', requireAuth, async (_req: Request, res: Response) => {
  const list = await prisma.project.findMany({ take: 50, orderBy: { createdAt: 'desc' } });
  const total = await prisma.project.count();
  res.json({ success: true, data: list, pagination: { total, take: 50, skip: 0 } });
});

router.post('/', requireAuth, async (req: Request, res: Response) => {
  const parsed = projectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid', details: parsed.error.flatten().fieldErrors } });
  const payload = parsed.data.status ? parsed.data : { ...parsed.data, status: 'ongoing' };
  const project = await prisma.project.create({ data: payload });
  await recordAuditLog({
    entity: 'project',
    entityId: project.id,
    action: 'create',
    after: project,
    userId: req.auth?.userId ?? null
  });
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
  const existing = await prisma.project.findUnique({ where: { id } });
  if (!existing) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } });
  }
  try {
    const updated = await prisma.project.update({ where: { id }, data: parsed.data });
    await recordAuditLog({
      entity: 'project',
      entityId: id,
      action: 'update',
      before: existing,
      after: updated,
      userId: req.auth?.userId ?? null
    });
    res.json({ success: true, data: updated });
  } catch {
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to update project' } });
  }
});

export default router;

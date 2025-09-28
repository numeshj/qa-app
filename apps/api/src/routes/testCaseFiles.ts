import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middlewares/auth';
import { z } from 'zod';

const router = Router();

const baseSchema = z.object({
  projectId: z.number(),
  name: z.string().min(1),
  version: z.string().optional(),
  environment: z.string().optional(),
  releaseBuild: z.string().optional(),
  refer: z.string().optional()
});

// List files (exclude soft deleted) with optional project filter
router.get('/', requireAuth, async (req: Request, res: Response) => {
  const projectId = req.query.projectId ? Number(req.query.projectId) : undefined;
  const where: any = { isDeleted: false };
  if (projectId) where.projectId = projectId;
  const list = await (prisma as any).testCaseFile.findMany({
    where,
    include: { project: true, author: true, _count: { select: { testCases: true } } },
    orderBy: { updatedAt: 'desc' }
  });
  res.json({ success: true, data: list });
});

router.post('/', requireAuth, async (req: Request, res: Response) => {
  const parsed = baseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid', details: parsed.error.flatten().fieldErrors } });
  try {
  const file = await (prisma as any).testCaseFile.create({ data: { ...parsed.data, authorId: req.auth?.userId } });
    res.status(201).json({ success: true, data: file });
  } catch (e: any) {
    return res.status(400).json({ success: false, error: { code: 'CREATE_FAILED', message: e.message || 'Failed' } });
  }
});

router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const file = await (prisma as any).testCaseFile.findFirst({ where: { id, isDeleted: false }, include: { project: true, author: true } });
  if (!file) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'File not found' } });
  res.json({ success: true, data: file });
});

router.put('/:id', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const parsed = baseSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid', details: parsed.error.flatten().fieldErrors } });
  try {
  const updated = await (prisma as any).testCaseFile.update({ where: { id }, data: { ...parsed.data } });
    res.json({ success: true, data: updated });
  } catch {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'File not found' } });
  }
});

// Soft delete
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  try {
  await (prisma as any).testCaseFile.update({ where: { id }, data: { isDeleted: true } });
    res.json({ success: true, data: { deleted: true } });
  } catch {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'File not found' } });
  }
});

export default router;
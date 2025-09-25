import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middlewares/auth';
import { z } from 'zod';

const router = Router();

const baseSchema = z.object({
  projectId: z.number(),
  testCaseIdCode: z.string().min(1),
  description: z.string().optional(),
  severity: z.enum(['High','Medium','Low']).optional(),
  complexity: z.enum(['High','Medium','Low']).optional(),
  status: z.enum(['Pass','Fail','On_Hold','Not_Applicable','Cannot_be_Executed','Blocked']).optional()
});

router.get('/', requireAuth, async (req: Request, res: Response) => {
  const projectId = req.query.projectId ? Number(req.query.projectId) : undefined;
  const where = projectId ? { projectId } : {};
  const list = await prisma.testCase.findMany({ where, take: 50, orderBy: { createdAt: 'desc' } });
  res.json({ success: true, data: list });
});

router.post('/', requireAuth, async (req: Request, res: Response) => {
  const parsed = baseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid', details: parsed.error.flatten().fieldErrors } });
  const tc = await prisma.testCase.create({ data: parsed.data });
  res.status(201).json({ success: true, data: tc });
});

router.put('/:id', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const parsed = baseSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid', details: parsed.error.flatten().fieldErrors } });
  try {
    const updated = await prisma.testCase.update({ where: { id }, data: parsed.data });
    res.json({ success: true, data: updated });
  } catch {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Test case not found' } });
  }
});

export default router;

import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middlewares/auth';
import { z } from 'zod';

const router = Router();

const schema = z.object({ category: z.string(), code: z.string(), label: z.string().optional(), sortOrder: z.number().optional() });

router.get('/:category', requireAuth, async (req: Request, res: Response) => {
  const category = req.params.category;
  const values = await prisma.lookupValue.findMany({ where: { category, active: true }, orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }] });
  res.json({ success: true, data: values });
});

router.post('/', requireAuth, async (req: Request, res: Response) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid', details: parsed.error.flatten().fieldErrors } });
  const created = await prisma.lookupValue.create({ data: parsed.data });
  res.status(201).json({ success: true, data: created });
});

export default router;

import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middlewares/auth';
import { z } from 'zod';

const router = Router();

// Basic audit log creation endpoint (for manual logging or future hooks)
const schema = z.object({ entity: z.string(), entityId: z.number(), action: z.string(), before: z.any().optional(), after: z.any().optional() });

router.post('/', requireAuth, async (req: Request, res: Response) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid', details: parsed.error.flatten().fieldErrors } });
  const created = await prisma.auditLog.create({ data: { entityType: parsed.data.entity, entityId: parsed.data.entityId, action: parsed.data.action, beforeJson: parsed.data.before, afterJson: parsed.data.after } });
  res.status(201).json({ success: true, data: created });
});

router.get('/', requireAuth, async (req: Request, res: Response) => {
  const take = 100; const skip = 0;
  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({ take, skip, orderBy: { createdAt: 'desc' } }),
    prisma.auditLog.count()
  ]);
  res.json({ success: true, data: rows, pagination: { total, take, skip } });
});

export default router;

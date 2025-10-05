import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middlewares/auth';
import { z } from 'zod';
import { Prisma } from '@prisma/client';

const router = Router();

// Basic audit log creation endpoint (for manual logging or future hooks)
const schema = z.object({ entity: z.string(), entityId: z.number(), action: z.string(), before: z.any().optional(), after: z.any().optional() });

router.post('/', requireAuth, async (req: Request, res: Response) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid', details: parsed.error.flatten().fieldErrors } });
  const created = await prisma.auditLog.create({ data: { entityType: parsed.data.entity, entityId: parsed.data.entityId, action: parsed.data.action, beforeJson: parsed.data.before, afterJson: parsed.data.after } });
  res.status(201).json({ success: true, data: created });
});

const querySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  take: z.coerce.number().int().min(1).max(100).optional(),
  entity: z.string().trim().min(1).optional(),
  action: z.string().trim().min(1).optional(),
  search: z.string().trim().min(1).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional()
});

router.get('/', requireAuth, async (req: Request, res: Response) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_QUERY', message: 'Invalid audit query params', details: parsed.error.flatten().fieldErrors } });
  }

  const { page = 1, take = 25, entity, action, search, from, to } = parsed.data;
  const skip = (page - 1) * take;

  const where: Prisma.AuditLogWhereInput = {};
  if (entity) where.entityType = entity;
  if (action) where.action = action;
  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {})
    };
  }
  if (search) {
    const orFilters: Prisma.AuditLogWhereInput[] = [
      { entityType: { contains: search } },
      { action: { contains: search } }
    ];
    const numeric = Number(search);
    if (!Number.isNaN(numeric)) {
      orFilters.push({ entityId: numeric });
    }
  orFilters.push({ user: { email: { contains: search } } });
    where.OR = orFilters;
  }

  const [rows, total, entityFacets, actionFacets] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      take,
      skip,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } }
    }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      distinct: ['entityType'],
      select: { entityType: true },
      orderBy: { entityType: 'asc' }
    }),
    prisma.auditLog.findMany({
      where,
      distinct: ['action'],
      select: { action: true },
      orderBy: { action: 'asc' }
    })
  ]);

  res.json({
    success: true,
    data: rows,
    pagination: {
      total,
      page,
      take
    },
    filters: {
      entities: entityFacets.map((f) => f.entityType).filter(Boolean),
      actions: actionFacets.map((f) => f.action).filter(Boolean)
    }
  });
});

export default router;

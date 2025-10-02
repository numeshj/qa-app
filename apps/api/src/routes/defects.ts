import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middlewares/auth';
import { z } from 'zod';

const router = Router();

const nullableString = z.preprocess((val) => {
  if (val === null || val === '' || typeof val === 'undefined') return undefined;
  return val;
}, z.string().optional());

const optionalNumber = z.preprocess((val) => {
  if (val === null || val === '' || typeof val === 'undefined') return undefined;
  if (typeof val === 'string' && val.trim() === '') return undefined;
  const parsed = Number(val);
  if (Number.isNaN(parsed)) return val;
  return parsed;
}, z.number().int().positive().optional());

const requiredNumber = z.preprocess((val) => {
  if (typeof val === 'string' && val.trim() !== '') {
    const parsed = Number(val);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return val;
}, z.number().int().positive());

const baseSchema = z.object({
  projectId: requiredNumber,
  defectFileId: optionalNumber,
  defectIdCode: z.string().min(1),
  module: nullableString,
  title: z.string().min(1),
  description: nullableString,
  testData: z.any().optional(),
  actualResults: nullableString,
  expectedResults: nullableString,
  priority: nullableString,
  severity: nullableString,
  status: nullableString,
  release: nullableString,
  assignedToId: optionalNumber,
  reportedById: optionalNumber,
  labels: nullableString,
  environment: nullableString,
  rcaStatus: nullableString,
  comments: nullableString,
  triageComments: nullableString,
  deliveryDate: nullableString,
  reportedDate: nullableString,
  closedDate: nullableString
});

const listQuerySchema = z.object({
  projectId: optionalNumber,
  fileId: optionalNumber,
  status: nullableString,
  search: nullableString
}).partial();

const toDate = (value?: string) => {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Invalid date');
  }
  return parsed;
};

const shapeResponse = (defect: any) => {
  const assigned = defect.assignedTo ? `${defect.assignedTo.firstName ?? ''} ${defect.assignedTo.lastName ?? ''}`.trim() : null;
  const reported = defect.reportedBy ? `${defect.reportedBy.firstName ?? ''} ${defect.reportedBy.lastName ?? ''}`.trim() : null;
  return {
    ...defect,
    assignedToName: assigned || null,
    reportedByName: reported || null,
    defectFileName: defect.defectFile?.name ?? null,
    projectName: defect.project?.name ?? null,
    artifactCount: defect._count?.artifacts ?? 0
  };
};

router.get('/', requireAuth, async (req: Request, res: Response) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid query params', details: parsed.error.flatten().fieldErrors } });
  }
  const { projectId, fileId, status, search } = parsed.data as any;
  const where: any = {};
  if (projectId) where.projectId = projectId;
  if (fileId) where.defectFileId = fileId;
  if (status) where.status = status;
  if (search) {
    const term = String(search);
    where.OR = [
      { defectIdCode: { contains: term, mode: 'insensitive' } },
      { title: { contains: term, mode: 'insensitive' } }
    ];
  }

  const list = await prisma.defect.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    include: {
      defectFile: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, firstName: true, lastName: true } },
      reportedBy: { select: { id: true, firstName: true, lastName: true } },
      _count: { select: { artifacts: true } }
    }
  });

  res.json({ success: true, data: list.map(shapeResponse) });
});

router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ success: false, error: { code: 'INVALID_ID', message: 'Invalid defect id' } });
  const defect = await prisma.defect.findUnique({
    where: { id },
    include: {
      defectFile: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, firstName: true, lastName: true } },
      reportedBy: { select: { id: true, firstName: true, lastName: true } },
      artifacts: { orderBy: { createdAt: 'desc' } }
    }
  });
  if (!defect) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Defect not found' } });
  const normalizedArtifacts = defect.artifacts.map((a) => ({ ...a, filePath: a.filePath.replace(/\\/g, '/') }));
  return res.json({ success: true, data: { ...shapeResponse(defect), artifacts: normalizedArtifacts } });
});

router.post('/', requireAuth, async (req: Request, res: Response) => {
  const parsed = baseSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid body', details: parsed.error.flatten().fieldErrors } });
  }
  const payload = parsed.data;
  try {
    const { deliveryDate, reportedDate, closedDate, ...rest } = payload;
    const created = await prisma.defect.create({
      data: {
        ...rest,
        deliveryDate: toDate(deliveryDate as any),
        reportedDate: toDate(reportedDate as any),
        closedDate: toDate(closedDate as any)
      }
    });
    res.status(201).json({ success: true, data: created });
  } catch (err: any) {
    const message = err?.message === 'Invalid date' ? 'Invalid date format' : (err?.message || 'Failed to create defect');
    res.status(400).json({ success: false, error: { code: 'CREATE_FAILED', message } });
  }
});

router.put('/:id', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ success: false, error: { code: 'INVALID_ID', message: 'Invalid defect id' } });
  const parsed = baseSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid body', details: parsed.error.flatten().fieldErrors } });
  }
  const payload = parsed.data;
  try {
    const { deliveryDate, reportedDate, closedDate, ...rest } = payload;
    const updated = await prisma.defect.update({
      where: { id },
      data: {
        ...rest,
        deliveryDate: deliveryDate !== undefined ? toDate(deliveryDate as any) : undefined,
        reportedDate: reportedDate !== undefined ? toDate(reportedDate as any) : undefined,
        closedDate: closedDate !== undefined ? toDate(closedDate as any) : undefined
      }
    });
    res.json({ success: true, data: updated });
  } catch (err: any) {
    if (err?.message === 'Invalid date') {
      return res.status(400).json({ success: false, error: { code: 'INVALID_DATE', message: 'Invalid date format' } });
    }
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Defect not found' } });
  }
});

router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ success: false, error: { code: 'INVALID_ID', message: 'Invalid defect id' } });
  try {
    await prisma.defect.delete({ where: { id } });
    res.json({ success: true, data: { deleted: true } });
  } catch {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Defect not found' } });
  }
});

export default router;

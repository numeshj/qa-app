import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middlewares/auth';
import { upload } from '../middlewares/upload';
import { z } from 'zod';
import { parseSheet, buildTemplate } from '../utils/xlsx';

const router = Router();

const baseSchema = z.object({
  projectId: z.number(),
  defectIdCode: z.string().min(1),
  defectFileId: z.number().optional(),
  module: z.string().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  testData: z.any().optional(),
  actualResults: z.string().optional(),
  expectedResults: z.string().optional(),
  priority: z.string().optional(),
  severity: z.string().optional(),
  status: z.string().optional(),
  release: z.string().optional(),
  assignedToId: z.number().optional(),
  deliveryDate: z.string().optional(),
  reportedById: z.number().optional(),
  labels: z.string().optional(),
  environment: z.string().optional(),
  rcaStatus: z.string().optional(),
  reportedDate: z.string().optional(),
  closedDate: z.string().optional(),
  comments: z.string().optional(),
  triageComments: z.string().optional()
});

router.get('/', requireAuth, async (req: Request, res: Response) => {
  const projectId = req.query.projectId ? Number(req.query.projectId) : undefined;
  const defectFileId = req.query.defectFileId ? Number(req.query.defectFileId) : undefined;
  const where: any = {};
  if (projectId) where.projectId = projectId;
  if (defectFileId) where.defectFileId = defectFileId;
  const take = 50; const skip = 0;
  const [list, total] = await Promise.all([
    (prisma as any).defect.findMany({ where, take, skip, orderBy: { createdAt: 'desc' }, include: { defectFile: { select: { id: true, name: true } } } }),
    prisma.defect.count({ where })
  ]);
  const shaped = list.map((d: any) => ({ ...d, defectFileName: d.defectFile?.name || null }));
  res.json({ success: true, data: shaped, pagination: { total, take, skip } });
});

router.post('/', requireAuth, async (req: Request, res: Response) => {
  const parsed = baseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid', details: parsed.error.flatten().fieldErrors } });
  const data: any = { ...parsed.data };
  if (data.reportedDate) data.reportedDate = new Date(data.reportedDate);
  if (data.closedDate) data.closedDate = new Date(data.closedDate);
  if (data.deliveryDate) data.deliveryDate = new Date(data.deliveryDate);
  const defect = await prisma.defect.create({ data });
  res.status(201).json({ success: true, data: defect });
});

router.put('/:id', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const parsed = baseSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid', details: parsed.error.flatten().fieldErrors } });
  try {
    const current = await prisma.defect.findUnique({ where: { id } });
    if (!current) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Defect not found' } });
    // Simple transition rule: cannot move from resolved/closed-like statuses back to inprogress unless 'reopened'
    const nextStatus = parsed.data.status;
    if (nextStatus && current.status && current.status !== nextStatus) {
      const terminal = ['resolved','rejected'];
      if (terminal.includes(current.status) && !['reopened'].includes(nextStatus)) {
        return res.status(400).json({ success: false, error: { code: 'INVALID_TRANSITION', message: `Cannot transition from ${current.status} to ${nextStatus}` } });
      }
    }
  const data: any = { ...parsed.data };
  if (data.reportedDate) data.reportedDate = new Date(data.reportedDate);
  if (data.closedDate) data.closedDate = new Date(data.closedDate);
  if (data.deliveryDate) data.deliveryDate = new Date(data.deliveryDate);
  const updated = await prisma.defect.update({ where: { id }, data });
    if (parsed.data.status && parsed.data.status !== current.status) {
      await prisma.auditLog.create({ data: { entityType: 'defect', entityId: id, action: 'status_change', beforeJson: { status: current.status }, afterJson: { status: parsed.data.status } } });
    }
    res.json({ success: true, data: updated });
  } catch (e) {
    return res.status(500).json({ success: false, error: { code: 'UPDATE_ERROR', message: 'Could not update defect' } });
  }
});

// Artifacts
router.post('/:id/artifacts', requireAuth, upload.single('file'), async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!req.file) return res.status(400).json({ success: false, error: { code: 'NO_FILE', message: 'File required' } });
  const artifact = await prisma.defectArtifact.create({ data: {
    defectId: id,
    type: req.file.mimetype.startsWith('video') ? 'video' : 'image',
    filePath: req.file.path,
    originalName: req.file.originalname,
    mimeType: req.file.mimetype,
    sizeBytes: req.file.size
  }});
  res.status(201).json({ success: true, data: artifact });
});

router.get('/:id/artifacts', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const list = await prisma.defectArtifact.findMany({ where: { defectId: id }, orderBy: { createdAt: 'desc' } });
  res.json({ success: true, data: list });
});

router.get('/:id/artifacts/summary', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const [count, latest] = await Promise.all([
    prisma.defectArtifact.count({ where: { defectId: id } }),
    prisma.defectArtifact.findFirst({ where: { defectId: id }, orderBy: { createdAt: 'desc' } })
  ]);
  res.json({ success: true, data: { count, latest } });
});

router.delete('/:id/artifacts/:artifactId', requireAuth, async (req: Request, res: Response) => {
  const artifactId = Number(req.params.artifactId);
  try {
    await prisma.defectArtifact.delete({ where: { id: artifactId } });
    res.json({ success: true, data: { deleted: true } });
  } catch {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Artifact not found' } });
  }
});

// Import / Export endpoints
router.get('/export/xlsx', requireAuth, async (req: Request, res: Response) => {
  const projectId = req.query.projectId ? Number(req.query.projectId) : undefined;
  const defectFileId = req.query.defectFileId ? Number(req.query.defectFileId) : undefined;
  const where: any = {};
  if (projectId) where.projectId = projectId;
  if (defectFileId) where.defectFileId = defectFileId;
  const rows = await (prisma as any).defect.findMany({ where, orderBy: { id: 'asc' }, include: { defectFile: { select: { id: true, name: true } } } });
  const headers = [
    'projectId','defectIdCode','defectFileId','defectFileName','module','title','description','testData','actualResults','expectedResults','priority','severity','status','release','assignedToId','deliveryDate','reportedById','labels','environment','rcaStatus','reportedDate','closedDate','comments','triageComments'
  ];
  try {
    const { buildWorkbook, workbookToBuffer } = await import('../utils/xlsx');
    const shaped = rows.map((r: any) => ({
      ...r,
      defectFileName: r.defectFile?.name || null
    }));
    const wb = buildWorkbook<any>({ sheetName: 'Defects', headers: headers.map(h => ({ key: h as any, label: h })) }, shaped as any);
    const buf = workbookToBuffer(wb);
    res.setHeader('Content-Disposition', 'attachment; filename="defects.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    return res.send(buf);
  } catch {
    const lines = [headers.join(',')];
    for (const r of rows) {
      const defectFileName = (r as any).defectFile?.name || '';
      const rowObj: any = { ...r, defectFileName };
      lines.push(headers.map(h => rowObj[h] ?? '').join(','));
    }
    res.setHeader('Content-Disposition', 'attachment; filename="defects.csv"');
    res.setHeader('Content-Type', 'text/csv');
    return res.send(lines.join('\n'));
  }
});

router.get('/template/xlsx', requireAuth, async (_req: Request, res: Response) => {
  const headers = [
    'projectId','defectIdCode','defectFileId','defectFileName','module','title','description','testData','actualResults','expectedResults','priority','severity','status','release','assignedToId','deliveryDate','reportedById','labels','environment','rcaStatus','reportedDate','closedDate','comments','triageComments'
  ];
  try {
    const buf = buildTemplate(headers, 'Defects');
    res.setHeader('Content-Disposition', 'attachment; filename="defects-template.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    return res.send(buf);
  } catch {
    res.setHeader('Content-Disposition', 'attachment; filename="defects-template.csv"');
    res.setHeader('Content-Type', 'text/csv');
    return res.send(headers.join(','));
  }
});

router.post('/import/xlsx', requireAuth, upload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ success: false, error: { code: 'NO_FILE', message: 'File required' } });
  const buffer = req.file.buffer || req.file.path ? require('fs').readFileSync(req.file.path) : undefined;
  if (!buffer) return res.status(400).json({ success: false, error: { code: 'READ_ERROR', message: 'Could not read file' } });
  const { rows, errors } = parseSheet<any>(buffer);
  const created: any[] = []; const failed: any[] = [];
  // Preload defect files for name->id resolution
  let filesById: Map<number, any> | null = null;
  let fileByProjectAndName: Map<string, any> | null = null;
  const anyPrisma: any = prisma as any;
  if (anyPrisma.defectFile) {
    try {
      const files = await anyPrisma.defectFile.findMany({ select: { id: true, name: true, projectId: true, isDeleted: true } });
      filesById = new Map(files.map((f: any) => [f.id, f]));
      fileByProjectAndName = new Map(files.map((f: any) => [`${f.projectId}::${(f.name||'').toLowerCase()}`, f]));
    } catch { /* ignore */ }
  }
  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];
    let defectFileId: number | undefined = undefined;
    if (raw.defectFileId && /^\d+$/.test(String(raw.defectFileId).trim())) {
      const idNum = Number(String(raw.defectFileId).trim());
      if (!filesById || filesById.has(idNum)) defectFileId = idNum; else {
        failed.push({ row: i + 2, errors: [`Unknown defectFileId '${raw.defectFileId}'`] });
        continue;
      }
    } else if (raw.defectFileName) {
      const key = `${raw.projectId}::${String(raw.defectFileName).trim().toLowerCase()}`;
      if (!fileByProjectAndName || fileByProjectAndName.has(key)) {
        defectFileId = fileByProjectAndName ? fileByProjectAndName.get(key)?.id : undefined;
        if (fileByProjectAndName && !defectFileId) {
          failed.push({ row: i + 2, errors: [`Unknown defectFileName '${raw.defectFileName}' for project ${raw.projectId}`] });
          continue;
        }
      }
    }
    const parsed = baseSchema.safeParse({
      projectId: Number(raw.projectId),
      defectIdCode: String(raw.defectIdCode || '').trim(),
      defectFileId,
      module: raw.module || undefined,
      title: String(raw.title || '').trim(),
      description: raw.description || undefined,
      testData: raw.testData || undefined,
      actualResults: raw.actualResults || undefined,
      expectedResults: raw.expectedResults || undefined,
      priority: raw.priority || undefined,
      severity: raw.severity || undefined,
      status: raw.status || undefined,
      release: raw.release || undefined,
      assignedToId: raw.assignedToId ? Number(raw.assignedToId) : undefined,
      deliveryDate: raw.deliveryDate || undefined,
      reportedById: raw.reportedById ? Number(raw.reportedById) : undefined,
      labels: raw.labels || undefined,
      environment: raw.environment || undefined,
      rcaStatus: raw.rcaStatus || undefined,
      reportedDate: raw.reportedDate || undefined,
      closedDate: raw.closedDate || undefined,
      comments: raw.comments || undefined,
      triageComments: raw.triageComments || undefined
    });
    if (!parsed.success) {
      failed.push({ row: i + 2, errors: parsed.error.issues.map(is => is.message) });
      continue;
    }
    try {
      const existing = await prisma.defect.findFirst({ where: { defectIdCode: parsed.data.defectIdCode, projectId: parsed.data.projectId } });
      if (existing) {
        await prisma.defect.update({ where: { id: existing.id }, data: parsed.data });
        created.push({ row: i + 2, mode: 'updated', id: existing.id });
      } else {
        const df = await prisma.defect.create({ data: parsed.data });
        created.push({ row: i + 2, mode: 'created', id: df.id });
      }
    } catch (e: any) {
      failed.push({ row: i + 2, errors: [e.message || 'DB error'] });
    }
  }
  res.json({ success: true, data: { summary: { created: created.length, failed: failed.length }, created, failed, parseErrors: errors } });
});

export default router;

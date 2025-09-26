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
  title: z.string().min(1),
  severity: z.string().optional(), // dynamic via lookup_values
  priority: z.string().optional(),
  status: z.string().optional()
});

router.get('/', requireAuth, async (req: Request, res: Response) => {
  const projectId = req.query.projectId ? Number(req.query.projectId) : undefined;
  const where = projectId ? { projectId } : {};
  const take = 50; const skip = 0;
  const [list, total] = await Promise.all([
    prisma.defect.findMany({ where, take, skip, orderBy: { createdAt: 'desc' } }),
    prisma.defect.count({ where })
  ]);
  res.json({ success: true, data: list, pagination: { total, take, skip } });
});

router.post('/', requireAuth, async (req: Request, res: Response) => {
  const parsed = baseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid', details: parsed.error.flatten().fieldErrors } });
  const defect = await prisma.defect.create({ data: parsed.data });
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
    const updated = await prisma.defect.update({ where: { id }, data: parsed.data });
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
  const where = projectId ? { projectId } : {};
  const rows = await prisma.defect.findMany({ where, orderBy: { id: 'asc' } });
  const headers = ['projectId','defectIdCode','title','severity','priority','status'];
  try {
    const { buildWorkbook, workbookToBuffer } = await import('../utils/xlsx');
    const wb = buildWorkbook<any>({ sheetName: 'Defects', headers: headers.map(h => ({ key: h as any, label: h })) }, rows as any);
    const buf = workbookToBuffer(wb);
    res.setHeader('Content-Disposition', 'attachment; filename="defects.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    return res.send(buf);
  } catch {
    const lines = [headers.join(',')];
    for (const r of rows) lines.push(headers.map(h => (r as any)[h] ?? '').join(','));
    res.setHeader('Content-Disposition', 'attachment; filename="defects.csv"');
    res.setHeader('Content-Type', 'text/csv');
    return res.send(lines.join('\n'));
  }
});

router.get('/template/xlsx', requireAuth, async (_req: Request, res: Response) => {
  const headers = ['projectId','defectIdCode','title','severity','priority','status'];
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
  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];
    const parsed = baseSchema.safeParse({
      projectId: Number(raw.projectId),
      defectIdCode: String(raw.defectIdCode || '').trim(),
      title: String(raw.title || '').trim(),
      severity: raw.severity || undefined,
      priority: raw.priority || undefined,
      status: raw.status || undefined
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

import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middlewares/auth';
import { upload } from '../middlewares/upload';
import { z } from 'zod';
import { parseSheet, buildTemplate } from '../utils/xlsx';

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
  const take = 50; const skip = 0;
  const [list, total] = await Promise.all([
    prisma.testCase.findMany({ where, take, skip, orderBy: { createdAt: 'desc' } }),
    prisma.testCase.count({ where })
  ]);
  res.json({ success: true, data: list, pagination: { total, take, skip } });
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

// Artifacts
router.post('/:id/artifacts', requireAuth, upload.single('file'), async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!req.file) return res.status(400).json({ success: false, error: { code: 'NO_FILE', message: 'File required' } });
  const artifact = await prisma.testCaseArtifact.create({ data: {
    testCaseId: id,
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
  const list = await prisma.testCaseArtifact.findMany({ where: { testCaseId: id }, orderBy: { createdAt: 'desc' } });
  res.json({ success: true, data: list });
});

router.get('/:id/artifacts/summary', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const [count, latest] = await Promise.all([
    prisma.testCaseArtifact.count({ where: { testCaseId: id } }),
    prisma.testCaseArtifact.findFirst({ where: { testCaseId: id }, orderBy: { createdAt: 'desc' } })
  ]);
  res.json({ success: true, data: { count, latest } });
});

router.delete('/:id/artifacts/:artifactId', requireAuth, async (req: Request, res: Response) => {
  const artifactId = Number(req.params.artifactId);
  try {
    await prisma.testCaseArtifact.delete({ where: { id: artifactId } });
    res.json({ success: true, data: { deleted: true } });
  } catch {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Artifact not found' } });
  }
});

// Import / Export endpoints
router.get('/export/xlsx', requireAuth, async (req: Request, res: Response) => {
  const projectId = req.query.projectId ? Number(req.query.projectId) : undefined;
  const where = projectId ? { projectId } : {};
  const rows = await prisma.testCase.findMany({ where, orderBy: { id: 'asc' } });
  const headers = ['projectId','testCaseIdCode','description','severity','complexity','status'];
  const content = [headers.join(',')]; // CSV fallback if Excel fails later
  // Build workbook
  try {
    const { buildWorkbook, workbookToBuffer } = await import('../utils/xlsx');
    const wb = buildWorkbook<any>({ sheetName: 'TestCases', headers: headers.map(h => ({ key: h as any, label: h })) }, rows as any);
    const buf = workbookToBuffer(wb);
    res.setHeader('Content-Disposition', 'attachment; filename="test-cases.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    return res.send(buf);
  } catch {
    res.setHeader('Content-Disposition', 'attachment; filename="test-cases.csv"');
    res.setHeader('Content-Type', 'text/csv');
    for (const r of rows) {
      content.push(headers.map(h => (r as any)[h] ?? '').join(','));
    }
    return res.send(content.join('\n'));
  }
});

router.get('/template/xlsx', requireAuth, async (_req: Request, res: Response) => {
  const headers = ['projectId','testCaseIdCode','description','severity','complexity','status'];
  try {
    const buf = buildTemplate(headers, 'TestCases');
    res.setHeader('Content-Disposition', 'attachment; filename="test-cases-template.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    return res.send(buf);
  } catch {
    res.setHeader('Content-Disposition', 'attachment; filename="test-cases-template.csv"');
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
      testCaseIdCode: String(raw.testCaseIdCode || '').trim(),
      description: raw.description ? String(raw.description) : undefined,
      severity: raw.severity || undefined,
      complexity: raw.complexity || undefined,
      status: raw.status || undefined
    });
    if (!parsed.success) {
      failed.push({ row: i + 2, errors: parsed.error.issues.map(is => is.message) });
      continue;
    }
    try {
      const existing = await prisma.testCase.findFirst({ where: { testCaseIdCode: parsed.data.testCaseIdCode, projectId: parsed.data.projectId } });
      if (existing) {
        await prisma.testCase.update({ where: { id: existing.id }, data: parsed.data });
        created.push({ row: i + 2, mode: 'updated', id: existing.id });
      } else {
        const tc = await prisma.testCase.create({ data: parsed.data });
        created.push({ row: i + 2, mode: 'created', id: tc.id });
      }
    } catch (e: any) {
      failed.push({ row: i + 2, errors: [e.message || 'DB error'] });
    }
  }
  res.json({ success: true, data: { summary: { created: created.length, failed: failed.length }, created, failed, parseErrors: errors } });
});

export default router;

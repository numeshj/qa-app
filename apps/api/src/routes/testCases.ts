import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middlewares/auth';
import { upload } from '../middlewares/upload';
import { z } from 'zod';
import { parseSheet, buildTemplate } from '../utils/xlsx';
import { asyncHandler } from '../utils/asyncHandler';
import multer from 'multer';

const router = Router();

// Dedicated uploader for data imports (allow .xlsx / .csv) using memory storage
const importUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv'
    ];
    if (!allowed.includes(file.mimetype)) return cb(new Error('INVALID_IMPORT_FILE_TYPE'));
    cb(null, true);
  }
});

const baseSchema = z.object({
  projectId: z.number(),
  testCaseIdCode: z.string().min(1),
  testCaseFileId: z.number().optional(),
  category: z.string().optional(),
  featureName: z.string().optional(),
  description: z.string().optional(),
  subFunctionality: z.string().optional(),
  preRequisite: z.string().optional(),
  inputData: z.any().optional(),
  expectedResult: z.string().optional(),
  severity: z.enum(['High','Medium','Low']).optional(),
  complexity: z.enum(['High','Medium','Low']).optional(),
  actualResult: z.string().optional(),
  status: z.enum(['Pass','Fail','On_Hold','Not_Applicable','Cannot_be_Executed','Blocked']).optional(),
  defectIdRef: z.string().optional(),
  comments: z.string().optional(),
  labels: z.string().optional()
});

// Query validation to avoid NaN / invalid values triggering ORM errors and crashing server
const listQuerySchema = z.object({
  projectId: z.preprocess(val => val === undefined ? undefined : Number(val), z.number().int().positive().optional()).optional(),
  fileId: z.preprocess(val => val === undefined ? undefined : Number(val), z.number().int().positive().optional()).optional()
}).partial();

router.get('/', requireAuth, asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid query params', details: parsed.error.flatten().fieldErrors } });
  }
  const { projectId, fileId } = parsed.data as any;
  const where: any = {};
  if (projectId) where.projectId = projectId;
  if (fileId) where.testCaseFileId = fileId;
  // Soft delete removed for TestCase; no isDeleted filter
  const take = 50; const skip = 0;
  let list: any[] = [];
  let total = 0;
  const debug = req.query.__debug === '1';
  try {
    if (debug) console.log('[test-cases:list] primary query where=', JSON.stringify(where));
    [list, total] = await Promise.all([
      (prisma as any).testCase.findMany({ where, take, skip, orderBy: { createdAt: 'desc' }, include: { artifacts: { take: 1, orderBy: { createdAt: 'desc' } }, testCaseFile: { select: { id: true, name: true } } } }),
      prisma.testCase.count({ where })
    ]);
  } catch (err: any) {
    console.error('[test-cases:list] query failed', err);
    const msg = String(err?.message || '').toLowerCase();
    // Migration detection for is_deleted no longer needed after removal
    // Fallback simpler query without include to isolate issue (maybe relation or column)
    try {
      if (debug) console.log('[test-cases:list] attempting fallback simple query');
      list = await (prisma as any).testCase.findMany({ where, take, skip, orderBy: { createdAt: 'desc' } });
      total = await prisma.testCase.count({ where });
      if (debug) console.log('[test-cases:list] fallback succeeded listLen=', list.length);
    } catch (fallbackErr: any) {
      console.error('[test-cases:list] fallback failed', fallbackErr);
      return res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: 'Failed to load test cases', debug: debug ? { primary: { message: err?.message, code: err?.code }, fallback: { message: fallbackErr?.message, code: fallbackErr?.code } } : undefined } });
    }
  }
  const shaped = (list as any[]).map((tc: any) => {
    const latest = (tc as any).artifacts?.[0] || null;
    return {
      ...tc,
      testCaseFileName: (tc as any).testCaseFile?.name || null,
      artifactCount: (tc as any).artifacts ? ((tc as any).artifacts.length === 1 ? 1 : (tc as any).artifacts.length) : 0,
      latestArtifact: latest ? { ...latest, filePath: latest.filePath.replace(/\\/g,'/') } : null
    };
  });
  return res.json({ success: true, data: shaped, pagination: { total, take, skip }, debug: debug ? { where } : undefined });
}));

router.post('/', requireAuth, async (req: Request, res: Response) => {
  const parsed = baseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid', details: parsed.error.flatten().fieldErrors } });
  // Ensure JSON fields are stored correctly
  const data = { ...parsed.data, inputData: parsed.data.inputData ?? undefined } as any;
  const tc = await prisma.testCase.create({ data });
  res.status(201).json({ success: true, data: tc });
});

router.put('/:id', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const parsed = baseSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid', details: parsed.error.flatten().fieldErrors } });
  try {
  const data = { ...parsed.data, inputData: parsed.data.inputData ?? undefined } as any;
  const updated = await prisma.testCase.update({ where: { id }, data });
    res.json({ success: true, data: updated });
  } catch {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Test case not found' } });
  }
});

// Delete a test case (hard delete since soft delete removed)
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  try {
    await prisma.testCase.delete({ where: { id } });
    res.json({ success: true, data: { deleted: true, mode: 'hard' } });
  } catch {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to delete test case' } });
  }
});

// Artifacts
router.post('/:id/artifacts', requireAuth, upload.single('file'), async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!req.file) return res.status(400).json({ success: false, error: { code: 'NO_FILE', message: 'File required' } });
  // Normalize stored path: keep only path segment relative to upload root (strip leading uploads/ or ./uploads/)
  let relativePath = req.file.path.replace(/\\/g,'/');
  const match = relativePath.match(/uploads\/(.*)$/);
  if (match) relativePath = match[1];
  // If still contains './', trim it
  relativePath = relativePath.replace(/^\.\//,'');
  const artifact = await prisma.testCaseArtifact.create({ data: {
    testCaseId: id,
    type: req.file.mimetype.startsWith('video') ? 'video' : 'image',
    filePath: relativePath,
    originalName: req.file.originalname,
    mimeType: req.file.mimetype,
    sizeBytes: req.file.size
  }});
  res.status(201).json({ success: true, data: artifact });
});

router.get('/:id/artifacts', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const list = await prisma.testCaseArtifact.findMany({ where: { testCaseId: id }, orderBy: { createdAt: 'desc' } });
  res.json({ success: true, data: list.map(a => ({ ...a, filePath: a.filePath.replace(/\\/g,'/') })) });
});

router.get('/:id/artifacts/summary', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const [count, latest] = await Promise.all([
    prisma.testCaseArtifact.count({ where: { testCaseId: id } }),
    prisma.testCaseArtifact.findFirst({ where: { testCaseId: id }, orderBy: { createdAt: 'desc' } })
  ]);
  const normalizedLatest = latest ? { ...latest, filePath: latest.filePath.replace(/\\/g,'/') } : null;
  res.json({ success: true, data: { count, latest: normalizedLatest } });
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
  const where: any = projectId ? { projectId } : {};
  // Soft delete removed: no isDeleted filter
  const rows = await prisma.testCase.findMany({ where, orderBy: { id: 'asc' } });
  const headers = [
    'projectId','testCaseIdCode','testCaseFileId','testCaseFileName','category','featureName','description','subFunctionality','preRequisite','inputData','expectedResult','severity','complexity','actualResult','status','defectIdRef','comments','labels'
  ];
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
  const headers = [
    'projectId','testCaseIdCode','testCaseFileId','testCaseFileName','category','featureName','description','subFunctionality','preRequisite','inputData','expectedResult','severity','complexity','actualResult','status','defectIdRef','comments','labels'
  ];
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

router.post('/import/xlsx', requireAuth, importUpload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ success: false, error: { code: 'NO_FILE', message: 'File required' } });
  const buffer: Buffer | undefined = (req.file as any).buffer;
  if (!buffer) return res.status(400).json({ success: false, error: { code: 'READ_ERROR', message: 'Could not read file buffer' } });
  const { rows, errors } = parseSheet<any>(buffer);
  const created: any[] = []; const failed: any[] = [];
  // Cache projects for flexible project reference resolution (id, code, or name)
  const projects = await prisma.project.findMany({ select: { id: true, code: true, name: true } });
  const projectsByCode = new Map(projects.map(p => [p.code.toLowerCase(), p]));
  const projectsByName = new Map(projects.map(p => [p.name.toLowerCase(), p]));
  // Attempt to cache test case files for lookup; if delegate missing skip name resolution
  let filesById: Map<number, any> | null = null;
  let fileByProjectAndName: Map<string, any> | null = null;
  const anyPrisma: any = prisma as any;
  if (anyPrisma.testCaseFile) {
    try {
      const files = await anyPrisma.testCaseFile.findMany({ select: { id: true, name: true, projectId: true, isDeleted: true } });
      filesById = new Map(files.map((f: any) => [f.id, f]));
      fileByProjectAndName = new Map(files.map((f: any) => [`${f.projectId}::${(f.name||'').toLowerCase()}`, f]));
    } catch { /* ignore */ }
  }

  const resolveProjectId = (rawVal: any): number | undefined => {
    if (rawVal === undefined || rawVal === null || rawVal === '') return undefined;
    // If numeric-like
    if (/^\d+$/.test(String(rawVal).trim())) return Number(String(rawVal).trim());
    const key = String(rawVal).trim().toLowerCase();
    if (projectsByCode.has(key)) return projectsByCode.get(key)!.id;
    if (projectsByName.has(key)) return projectsByName.get(key)!.id;
    return undefined;
  };
  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];
    // Normalize casing for enums
    const normSeverity = raw.severity ? String(raw.severity).charAt(0).toUpperCase() + String(raw.severity).slice(1).toLowerCase() : undefined;
    const normComplexity = raw.complexity ? String(raw.complexity).charAt(0).toUpperCase() + String(raw.complexity).slice(1).toLowerCase() : undefined;
    const resolvedProjectId = resolveProjectId(raw.projectId);
    if (!resolvedProjectId) {
      failed.push({ row: i + 2, errors: [`Invalid project reference '${raw.projectId ?? ''}'. Use numeric projectId or existing project code/name.`] });
      continue;
    }
    // Resolve testCaseFileId: prefer explicit numeric id; else by name within project if provided
    let testCaseFileId: number | undefined = undefined;
    if (raw.testCaseFileId && /^\d+$/.test(String(raw.testCaseFileId).trim())) {
      const idNum = Number(String(raw.testCaseFileId).trim());
      if (!filesById || filesById.has(idNum)) testCaseFileId = idNum; else {
        failed.push({ row: i + 2, errors: [`Unknown testCaseFileId '${raw.testCaseFileId}'`] });
        continue;
      }
    } else if (raw.testCaseFileName) {
      const key = `${resolvedProjectId}::${String(raw.testCaseFileName).trim().toLowerCase()}`;
      if (!fileByProjectAndName || fileByProjectAndName.has(key)) {
        testCaseFileId = fileByProjectAndName ? fileByProjectAndName.get(key)?.id : undefined;
        if (fileByProjectAndName && !testCaseFileId) {
          failed.push({ row: i + 2, errors: [`Unknown testCaseFileName '${raw.testCaseFileName}' for project ${resolvedProjectId}`] });
          continue;
        }
      }
    }
      const parsed = baseSchema.safeParse({
        projectId: resolvedProjectId,
        testCaseIdCode: String(raw.testCaseIdCode || '').trim(),
  testCaseFileId,
        category: raw.category || undefined,
        featureName: raw.featureName || undefined,
        description: raw.description ? String(raw.description) : undefined,
        subFunctionality: raw.subFunctionality || undefined,
        preRequisite: raw.preRequisite || undefined,
        inputData: raw.inputData || undefined,
        expectedResult: raw.expectedResult || undefined,
        severity: normSeverity,
        complexity: normComplexity,
        actualResult: raw.actualResult || undefined,
        status: raw.status || undefined,
        defectIdRef: raw.defectIdRef || undefined,
        comments: raw.comments || undefined,
        labels: raw.labels || undefined
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

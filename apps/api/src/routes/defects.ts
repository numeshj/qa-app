import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middlewares/auth';
import { z } from 'zod';
import multer from 'multer';
import { parseSheet, buildTemplate } from '../utils/xlsx';
import { recordAuditLog } from '../utils/audit';

const router = Router();

// Dedicated uploader for Excel/CSV imports using in-memory storage (avoids persisting temp files)
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

const defectHeaders = [
  'projectId',
  'projectCode',
  'projectName',
  'defectFileId',
  'defectFileName',
  'defectIdCode',
  'title',
  'module',
  'description',
  'testData',
  'actualResults',
  'expectedResults',
  'priority',
  'severity',
  'status',
  'release',
  'assignedToId',
  'assignedToEmail',
  'reportedById',
  'reportedByEmail',
  'labels',
  'environment',
  'rcaStatus',
  'comments',
  'triageComments',
  'deliveryDate',
  'reportedDate',
  'closedDate'
] as const;

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

router.get('/export/xlsx', requireAuth, async (req: Request, res: Response) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid query params', details: parsed.error.flatten().fieldErrors } });
  }
  const { projectId, fileId } = parsed.data as any;
  const where: any = {};
  if (projectId) where.projectId = projectId;
  if (fileId) where.defectFileId = fileId;
  const rows = await prisma.defect.findMany({
    where,
    orderBy: { id: 'asc' },
    include: {
      defectFile: { select: { name: true } },
      project: { select: { code: true, name: true } },
      assignedTo: { select: { email: true } },
      reportedBy: { select: { email: true } }
    }
  });
  const dataset = rows.map((row) => ({
    projectId: row.projectId,
    projectCode: row.project?.code ?? '',
    projectName: row.project?.name ?? '',
    defectFileId: row.defectFileId ?? '',
    defectFileName: row.defectFile?.name ?? '',
    defectIdCode: row.defectIdCode,
    title: row.title,
    module: row.module ?? '',
    description: row.description ?? '',
    testData: row.testData ? JSON.stringify(row.testData) : '',
    actualResults: row.actualResults ?? '',
    expectedResults: row.expectedResults ?? '',
    priority: row.priority ?? '',
    severity: row.severity ?? '',
    status: row.status ?? '',
    release: row.release ?? '',
    assignedToId: row.assignedToId ?? '',
    assignedToEmail: row.assignedTo?.email ?? '',
    reportedById: row.reportedById ?? '',
    reportedByEmail: row.reportedBy?.email ?? '',
    labels: row.labels ?? '',
    environment: row.environment ?? '',
    rcaStatus: row.rcaStatus ?? '',
    comments: row.comments ?? '',
    triageComments: row.triageComments ?? '',
    deliveryDate: row.deliveryDate ? row.deliveryDate.toISOString() : '',
    reportedDate: row.reportedDate ? row.reportedDate.toISOString() : '',
    closedDate: row.closedDate ? row.closedDate.toISOString() : ''
  }));
  const headers = Array.from(defectHeaders);
  try {
    const { buildWorkbook, workbookToBuffer } = await import('../utils/xlsx');
    const wb = buildWorkbook<{ [key: string]: any }>({
      sheetName: 'Defects',
      headers: headers.map((h) => ({ key: h, label: h }))
    }, dataset as any);
    const buf = workbookToBuffer(wb);
    res.setHeader('Content-Disposition', 'attachment; filename="defects.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    return res.send(buf);
  } catch {
  const content = [headers.join(',')];
    for (const row of dataset) {
      content.push(headers.map((key) => {
        const value = (row as any)[key];
        return value === undefined || value === null ? '' : String(value);
      }).join(','));
    }
    res.setHeader('Content-Disposition', 'attachment; filename="defects.csv"');
    res.setHeader('Content-Type', 'text/csv');
    return res.send(content.join('\n'));
  }
});

router.get('/template/xlsx', requireAuth, async (_req: Request, res: Response) => {
  const headers = Array.from(defectHeaders);
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

router.post('/import/xlsx', requireAuth, importUpload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: { code: 'NO_FILE', message: 'File required' } });
  }
  const buffer: Buffer | undefined = (req.file as any).buffer;
  if (!buffer) {
    return res.status(400).json({ success: false, error: { code: 'READ_ERROR', message: 'Could not read file buffer' } });
  }
  const { rows, errors: parseErrors } = parseSheet<any>(buffer);
  const created: any[] = [];
  const failed: any[] = [];

  const projects = await prisma.project.findMany({ select: { id: true, code: true, name: true } });
  const projectsByCode = new Map(projects.map((p) => [p.code.toLowerCase(), p]));
  const projectsByName = new Map(projects.map((p) => [p.name.toLowerCase(), p]));
  const projectsById = new Map(projects.map((p) => [p.id, p]));

  const defectFiles = await prisma.defectFile.findMany({ select: { id: true, name: true, projectId: true, isDeleted: true } });
  const defectFilesById = new Map(defectFiles.map((f) => [f.id, f]));
  const defectFileByProjectAndName = new Map(defectFiles.map((f) => [`${f.projectId}::${(f.name || '').toLowerCase()}`, f]));

  const users = await prisma.user.findMany({ select: { id: true, email: true, firstName: true, lastName: true } });
  const usersById = new Map(users.map((u) => [u.id, u]));
  const usersByEmail = new Map(users.filter((u) => !!u.email).map((u) => [u.email.toLowerCase(), u]));

  const resolveProjectId = (raw: any): number | undefined => {
    if (raw === undefined || raw === null || raw === '') return undefined;
    if (typeof raw === 'number' && projectsById.has(raw)) return raw;
    const rawStr = String(raw).trim();
    if (!rawStr) return undefined;
    if (/^\d+$/.test(rawStr)) {
      const num = Number(rawStr);
      if (projectsById.has(num)) return num;
    }
    const key = rawStr.toLowerCase();
    if (projectsByCode.has(key)) return projectsByCode.get(key)!.id;
    if (projectsByName.has(key)) return projectsByName.get(key)!.id;
    return undefined;
  };

  const resolveDefectFileId = (projectId: number, rawId: any, rawName: any): { value?: number; error?: string } => {
    if ((rawId === undefined || rawId === null || rawId === '') && (rawName === undefined || rawName === null || rawName === '')) {
      return { value: undefined };
    }
    if (rawId !== undefined && rawId !== null && String(rawId).trim() !== '') {
      const str = String(rawId).trim();
      if (!/^\d+$/.test(str)) {
        return { error: `Invalid defectFileId '${rawId}'` };
      }
      const num = Number(str);
      const hit = defectFilesById.get(num);
      if (!hit) return { error: `Unknown defectFileId '${rawId}'` };
      if (hit.projectId !== projectId) return { error: `defectFileId ${num} does not belong to project ${projectId}` };
      return { value: num };
    }
    if (rawName !== undefined && rawName !== null && String(rawName).trim() !== '') {
      const key = `${projectId}::${String(rawName).trim().toLowerCase()}`;
      const match = defectFileByProjectAndName.get(key);
      if (!match) return { error: `Unknown defectFileName '${rawName}' for project ${projectId}` };
      return { value: match.id };
    }
    return { value: undefined };
  };

  const resolveUserId = (rawId: any, rawEmail: any, label: string): { value?: number; error?: string } => {
    if ((rawId === undefined || rawId === null || rawId === '') && (rawEmail === undefined || rawEmail === null || rawEmail === '')) {
      return { value: undefined };
    }
    if (rawId !== undefined && rawId !== null && String(rawId).trim() !== '') {
      const str = String(rawId).trim();
      if (!/^\d+$/.test(str)) return { error: `Invalid ${label} id '${rawId}'` };
      const num = Number(str);
      if (!usersById.has(num)) return { error: `Unknown ${label} id '${rawId}'` };
      return { value: num };
    }
    if (rawEmail !== undefined && rawEmail !== null && String(rawEmail).trim() !== '') {
      const key = String(rawEmail).trim().toLowerCase();
      const match = usersByEmail.get(key);
      if (!match) return { error: `Unknown ${label} email '${rawEmail}'` };
      return { value: match.id };
    }
    return { value: undefined };
  };

  const normalizeDate = (raw: any): { value?: string; error?: string } => {
    if (raw === undefined || raw === null || raw === '') return { value: undefined };
    if (typeof raw === 'number') {
      const millis = Math.round((raw - 25569) * 86400 * 1000);
      const date = new Date(millis);
      if (Number.isNaN(date.getTime())) return { error: `Invalid date serial '${raw}'` };
      return { value: date.toISOString() };
    }
    const parsed = new Date(String(raw));
    if (Number.isNaN(parsed.getTime())) return { error: `Invalid date '${raw}'` };
    return { value: parsed.toISOString() };
  };

  const normalizeTestData = (raw: any) => {
    if (raw === undefined || raw === null || raw === '') return undefined;
    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      if (!trimmed) return undefined;
      try {
        return JSON.parse(trimmed);
      } catch {
        return trimmed;
      }
    }
    return raw;
  };

  const toOptional = (raw: any) => {
    if (raw === undefined || raw === null) return undefined;
    const str = String(raw).trim();
    return str === '' ? undefined : str;
  };

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i] as Record<string, any>;
    const rowNumber = i + 2; // header row = 1
    const resolvedProjectId = resolveProjectId(raw.projectId ?? raw.projectCode ?? raw.projectName);
    if (!resolvedProjectId) {
      failed.push({ row: rowNumber, errors: [`Invalid project reference '${raw.projectId ?? raw.projectCode ?? raw.projectName ?? ''}'`] });
      continue;
    }
    const title = toOptional(raw.title);
    if (!title) {
      failed.push({ row: rowNumber, errors: ['Title is required'] });
      continue;
    }
    const defectIdCode = toOptional(raw.defectIdCode);
    if (!defectIdCode) {
      failed.push({ row: rowNumber, errors: ['defectIdCode is required'] });
      continue;
    }

    const fileResolution = resolveDefectFileId(resolvedProjectId, raw.defectFileId, raw.defectFileName);
    if (fileResolution.error) {
      failed.push({ row: rowNumber, errors: [fileResolution.error] });
      continue;
    }

    const assignedResolution = resolveUserId(raw.assignedToId, raw.assignedToEmail, 'assignedTo');
    if (assignedResolution.error) {
      failed.push({ row: rowNumber, errors: [assignedResolution.error] });
      continue;
    }
    const reportedResolution = resolveUserId(raw.reportedById, raw.reportedByEmail, 'reportedBy');
    if (reportedResolution.error) {
      failed.push({ row: rowNumber, errors: [reportedResolution.error] });
      continue;
    }

    const delivery = normalizeDate(raw.deliveryDate);
    if (delivery.error) {
      failed.push({ row: rowNumber, errors: [delivery.error] });
      continue;
    }
    const reported = normalizeDate(raw.reportedDate);
    if (reported.error) {
      failed.push({ row: rowNumber, errors: [reported.error] });
      continue;
    }
    const closed = normalizeDate(raw.closedDate);
    if (closed.error) {
      failed.push({ row: rowNumber, errors: [closed.error] });
      continue;
    }

    const payload = {
      projectId: resolvedProjectId,
      defectFileId: fileResolution.value,
      defectIdCode,
      module: toOptional(raw.module),
      title,
      description: toOptional(raw.description),
      testData: normalizeTestData(raw.testData ?? raw['test_data']),
      actualResults: toOptional(raw.actualResults ?? raw['actual_results']),
      expectedResults: toOptional(raw.expectedResults ?? raw['expected_results']),
      priority: toOptional(raw.priority),
      severity: toOptional(raw.severity),
      status: toOptional(raw.status),
      release: toOptional(raw.release),
      assignedToId: assignedResolution.value,
      reportedById: reportedResolution.value,
      labels: toOptional(raw.labels),
      environment: toOptional(raw.environment),
      rcaStatus: toOptional(raw.rcaStatus ?? raw['rca_status']),
      comments: toOptional(raw.comments),
      triageComments: toOptional(raw.triageComments ?? raw['triage_comments']),
      deliveryDate: delivery.value,
      reportedDate: reported.value,
      closedDate: closed.value
    };

    const parsed = baseSchema.safeParse(payload);
    if (!parsed.success) {
      failed.push({ row: rowNumber, errors: parsed.error.issues.map((issue) => issue.message) });
      continue;
    }

    try {
      const existing = await prisma.defect.findFirst({ where: { projectId: parsed.data.projectId as number, defectIdCode: parsed.data.defectIdCode } });
      if (existing) {
        await prisma.defect.update({ where: { id: existing.id }, data: parsed.data });
        created.push({ row: rowNumber, mode: 'updated', id: existing.id });
      } else {
        const record = await prisma.defect.create({ data: parsed.data });
        created.push({ row: rowNumber, mode: 'created', id: record.id });
      }
    } catch (err: any) {
      failed.push({ row: rowNumber, errors: [err?.message || 'DB error'] });
    }
  }

  return res.json({
    success: true,
    data: {
      summary: { created: created.length, failed: failed.length },
      created,
      failed,
      parseErrors
    }
  });
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
    await recordAuditLog({
      entity: 'defect',
      entityId: created.id,
      action: 'create',
      after: created,
      userId: req.auth?.userId ?? null
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
  const existing = await prisma.defect.findUnique({ where: { id } });
  if (!existing) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Defect not found' } });
  }
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
    await recordAuditLog({
      entity: 'defect',
      entityId: id,
      action: 'update',
      before: existing,
      after: updated,
      userId: req.auth?.userId ?? null
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
  const existing = await prisma.defect.findUnique({ where: { id } });
  if (!existing) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Defect not found' } });
  }
  try {
    await prisma.defect.delete({ where: { id } });
    await recordAuditLog({
      entity: 'defect',
      entityId: id,
      action: 'delete',
      before: existing,
      after: null,
      userId: req.auth?.userId ?? null
    });
    res.json({ success: true, data: { deleted: true } });
  } catch {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to delete defect' } });
  }
});

export default router;

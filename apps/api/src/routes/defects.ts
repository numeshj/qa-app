import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middlewares/auth';
import { upload } from '../middlewares/upload';
import { z } from 'zod';

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

router.delete('/:id/artifacts/:artifactId', requireAuth, async (req: Request, res: Response) => {
  const artifactId = Number(req.params.artifactId);
  try {
    await prisma.defectArtifact.delete({ where: { id: artifactId } });
    res.json({ success: true, data: { deleted: true } });
  } catch {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Artifact not found' } });
  }
});

export default router;

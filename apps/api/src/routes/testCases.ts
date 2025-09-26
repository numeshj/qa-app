import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middlewares/auth';
import { upload } from '../middlewares/upload';
import { z } from 'zod';

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

router.delete('/:id/artifacts/:artifactId', requireAuth, async (req: Request, res: Response) => {
  const artifactId = Number(req.params.artifactId);
  try {
    await prisma.testCaseArtifact.delete({ where: { id: artifactId } });
    res.json({ success: true, data: { deleted: true } });
  } catch {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Artifact not found' } });
  }
});

export default router;

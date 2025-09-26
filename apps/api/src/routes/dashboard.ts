import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middlewares/auth';

const router = Router();

router.get('/', requireAuth, async (_req: Request, res: Response) => {
  const [projects, testCases, defects, openDefects] = await Promise.all([
    prisma.project.count(),
    prisma.testCase.count(),
    prisma.defect.count(),
    prisma.defect.count({ where: { status: 'open' } })
  ]);
  res.json({ success: true, data: { projects, testCases, defects, openDefects } });
});

export default router;

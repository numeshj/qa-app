import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';

const router = Router();

// Simple direct SQL helper using prisma.$queryRawUnsafe for flexibility
async function columnExists(table: string, column: string) {
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT COUNT(*) as cnt FROM information_schema.columns WHERE table_name = ? AND column_name = ?`,
      table,
      column
    );
    const count = Number(rows?.[0]?.cnt || 0);
    return count > 0;
  } catch (e) {
    return false;
  }
}

router.get('/schema', async (_req: Request, res: Response) => {
  const [tcHas, tcfHas] = await Promise.all([
    columnExists('test_cases', 'is_deleted'),
    columnExists('test_case_files', 'is_deleted')
  ]);
  res.json({ success: true, data: { test_cases: { is_deleted: tcHas }, test_case_files: { is_deleted: tcfHas } } });
});

export default router;
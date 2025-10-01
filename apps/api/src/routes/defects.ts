import { Router } from 'express';
import { requireAuth } from '../middlewares/auth';

// Defects module removed: respond with 410 for any request.
const router = Router();
router.all('*', requireAuth, (_req, res) => {
  res.status(410).json({ success: false, error: { code: 'DEFECTS_REMOVED', message: 'Defect module removed.' } });
});

export default router;

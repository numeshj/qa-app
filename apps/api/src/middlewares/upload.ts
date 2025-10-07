import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { env } from '../config/env';
import { prisma } from '../lib/prisma';
import { Request } from 'express';
import { nanoid } from 'nanoid';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const entity = (req.baseUrl.includes('defects') ? 'defects' : 'test-cases');
    const id = req.params.id || 'unknown';
    const dir = path.join(env.UPLOAD_DIR, entity, id);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: async (req: any, file, cb) => {
    try {
      const ext = path.extname(file.originalname).toLowerCase();
      const entity = (req.baseUrl.includes('defects') ? 'defect' : 'testcase');
      let code = 'unknown';
      if (req.params?.id) {
        const numericId = Number(req.params.id);
        if (!Number.isNaN(numericId)) {
          if (entity === 'testcase') {
            const tc = await prisma.testCase.findUnique({ where: { id: numericId }, select: { testCaseIdCode: true, projectId: true } });
            if (tc) {
              code = `${tc.projectId}_${tc.testCaseIdCode}`.replace(/[^A-Za-z0-9_\-]/g, '_');
            }
          } else {
            const defect = await prisma.defect.findUnique({ where: { id: numericId }, select: { defectIdCode: true, projectId: true } });
            if (defect) {
              code = `${defect.projectId}_${defect.defectIdCode}`.replace(/[^A-Za-z0-9_\-]/g, '_');
            }
          }
        }
      }
      const timestamp = Date.now();
      cb(null, `${entity}_${code}_${timestamp}${ext}`);
    } catch {
      cb(null, nanoid() + path.extname(file.originalname));
    }
  }
});

const fileFilter: multer.Options['fileFilter'] = (_req: Request, file, cb) => {
  const allowed = [
    'image/png','image/jpeg','image/webp','image/jpg','video/mp4','video/webm'
  ];
  if (!allowed.includes(file.mimetype)) return cb(new Error('INVALID_FILE_TYPE'));
  cb(null, true);
};

export const upload = multer({
  storage,
  limits: { fileSize: env.MAX_FILE_SIZE_MB * 1024 * 1024 },
  fileFilter
});

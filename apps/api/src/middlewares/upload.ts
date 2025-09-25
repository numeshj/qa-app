import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { env } from '../config/env';
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
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, nanoid() + ext);
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

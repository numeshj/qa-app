import { NextFunction, Request, Response } from 'express';
import { fail } from '../utils/responses';

// Minimal central error handler
export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  console.error(err);
  if (err?.name === 'ZodError') {
    return res.status(400).json(fail('VALIDATION_ERROR', 'Validation failed', err.flatten().fieldErrors));
  }
  return res.status(500).json(fail('INTERNAL_ERROR', 'Something went wrong'));
}

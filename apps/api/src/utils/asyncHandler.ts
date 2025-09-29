import { Request, Response, NextFunction, RequestHandler } from 'express';

// Generic async handler to forward rejected promises / thrown errors to Express error middleware
export function asyncHandler<T extends RequestHandler>(fn: T) {
  return function wrapped(req: Request, res: Response, next: NextFunction) {
    Promise.resolve(fn(req, res, next)).catch(next);
  } as unknown as T;
}

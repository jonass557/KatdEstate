import type { RequestHandler } from 'express';
import { AppError } from '../common/errors.js';

export const notFound: RequestHandler = (req, _res, next) => {
  next(new AppError('NOT_FOUND', `Route not found: ${req.method} ${req.path}`, 404));
};

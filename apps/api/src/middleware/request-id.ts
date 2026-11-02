import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';

const requestIdPattern = /^[A-Za-z0-9._-]{1,96}$/;

export const requestId: RequestHandler = (req, res, next) => {
  const candidate = req.header('X-Request-Id');
  const id = candidate && requestIdPattern.test(candidate) ? candidate : `req_${randomUUID()}`;
  req.requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
};

import type { FastifyReply, FastifyRequest } from 'fastify';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from '../errors/app-error.js';
import { HTTP_CODES } from '@launcher/shared';

export async function authenticate(request: FastifyRequest, _reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new AppError(HTTP_CODES.UNAUTHORIZED, 401, 'Missing bearer token');
  }

  try {
    const token = authHeader.slice(7);
    const payload = jwt.verify(token, env.JWT_SECRET) as { discordId: string; deviceId: string; licenseId: string };
    const typedRequest = request as FastifyRequest & { user?: typeof payload };
    typedRequest.user = payload;
  } catch {
    throw new AppError(HTTP_CODES.UNAUTHORIZED, 401, 'Invalid token');
  }
}

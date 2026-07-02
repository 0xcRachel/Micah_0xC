import type { FastifyRequest, FastifyReply } from 'fastify';
import { ZodSchema } from 'zod';
import { AppError } from '../errors/app-error.js';
import { HTTP_CODES } from '@launcher/shared';

export function validateBody(schema: ZodSchema) {
  return async function (request: FastifyRequest, _reply: FastifyReply) {
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(HTTP_CODES.BAD_REQUEST, 400, 'Invalid request body');
    }
    request.body = parsed.data;
  };
}

export function validateParams(schema: ZodSchema) {
  return async function (request: FastifyRequest, _reply: FastifyReply) {
    const parsed = schema.safeParse(request.params);
    if (!parsed.success) {
      throw new AppError(HTTP_CODES.BAD_REQUEST, 400, 'Invalid route params');
    }
    request.params = parsed.data;
  };
}

export function validateQuery(schema: ZodSchema) {
  return async function (request: FastifyRequest, _reply: FastifyReply) {
    const parsed = schema.safeParse(request.query);
    if (!parsed.success) {
      throw new AppError(HTTP_CODES.BAD_REQUEST, 400, 'Invalid query parameters');
    }
    request.query = parsed.data;
  };
}

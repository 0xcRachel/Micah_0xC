import type { FastifyRequest, FastifyReply } from 'fastify';
import { ZodSchema } from 'zod';
export declare function validateBody(schema: ZodSchema): (request: FastifyRequest, _reply: FastifyReply) => Promise<void>;
export declare function validateParams(schema: ZodSchema): (request: FastifyRequest, _reply: FastifyReply) => Promise<void>;
export declare function validateQuery(schema: ZodSchema): (request: FastifyRequest, _reply: FastifyReply) => Promise<void>;

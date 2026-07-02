import type { FastifyReply, FastifyRequest } from 'fastify';
export interface AuthenticatedRequest extends FastifyRequest {
    user?: {
        discordId: string;
        deviceId: string;
        licenseId: string;
    };
}
export type AppRequest<TBody = unknown, TParams = unknown, TQuery = unknown, THeaders = unknown> = FastifyRequest<{
    Body: TBody;
    Params: TParams;
    Querystring: TQuery;
    Headers: THeaders;
}>;
export type AppReply = FastifyReply;

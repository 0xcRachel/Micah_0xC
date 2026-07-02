import { HTTP_CODES } from '@launcher/shared';
import { AppError } from '../errors/app-error.js';
import { createErrorResponse } from '@launcher/shared';
export function errorHandler(error, _request, reply) {
    if (error instanceof AppError) {
        reply.status(error.statusCode).send(createErrorResponse(error.code, error.message));
        return;
    }
    reply.status(500).send(createErrorResponse(HTTP_CODES.SERVER_ERROR, 'Internal server error'));
}
//# sourceMappingURL=error-handler.js.map
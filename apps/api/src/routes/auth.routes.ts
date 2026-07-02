import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { AuthController } from '../controllers/auth.controller.js';
import { validateBody } from '../middlewares/validation.js';
import { bindSchema, loginSchema, licenseCreateSchema, verifySchema } from '@launcher/shared';
import type { AppReply, AppRequest } from '../types/http.js';

function wrapHandler(controllerMethod: (request: AppRequest, reply: AppReply) => Promise<void>) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    await controllerMethod(request as AppRequest, reply as AppReply);
  };
}

export async function authRoutes(app: FastifyInstance) {
  const controller = new AuthController();

  app.post('/bind', { preHandler: validateBody(bindSchema) }, wrapHandler(controller.bind));
  app.post('/license/create', { preHandler: validateBody(licenseCreateSchema) }, wrapHandler(controller.createLicense));
  app.post('/license/verify', { preHandler: validateBody(verifySchema) }, wrapHandler(controller.verifyLicense));
  app.post('/login', { preHandler: validateBody(loginSchema) }, wrapHandler(controller.login));
  app.post('/logout', wrapHandler(controller.logout));
  app.post('/heartbeat', wrapHandler(controller.heartbeat));
  app.post('/device/reset', { preHandler: validateBody(bindSchema) }, wrapHandler(controller.resetDevice));
  app.get('/version', wrapHandler(controller.version));
  app.get('/notice', wrapHandler(controller.notice));
  app.get('/health', wrapHandler(controller.health));
}

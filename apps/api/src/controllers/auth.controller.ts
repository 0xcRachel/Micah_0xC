import type { AppReply, AppRequest } from '../types/http.js';
import { AuthService } from '../services/auth.service.js';
import { createSuccessResponse } from '@launcher/shared';
import { bindSchema, loginSchema, licenseCreateSchema, verifySchema } from '@launcher/shared';
import { authenticate } from '../middlewares/auth.js';

export class AuthController {
  constructor(private readonly authService = new AuthService()) {}

  bind = async (request: AppRequest, reply: AppReply) => {
    const payload = bindSchema.parse(request.body);
    const data = await this.authService.bindDevice(payload.discordId, payload.deviceId);
    reply.send(createSuccessResponse(data, 'Device bound successfully'));
  };

  createLicense = async (request: AppRequest, reply: AppReply) => {
    const payload = licenseCreateSchema.parse(request.body);
    const data = await this.authService.createLicense(payload.discordId, payload.deviceId);
    reply.send(createSuccessResponse(data, 'License created successfully'));
  };

  verifyLicense = async (request: AppRequest, reply: AppReply) => {
    const payload = verifySchema.parse(request.body);
    const data = await this.authService.verifyLicense(payload.licenseKey, payload.deviceId, payload.discordId);
    reply.send(createSuccessResponse({ valid: Boolean(data) }, 'License verified'));
  };

  login = async (request: AppRequest, reply: AppReply) => {
    const payload = loginSchema.parse(request.body);
    const data = await this.authService.login(payload.discordId, payload.deviceId, payload.licenseKey);
    reply.send(createSuccessResponse(data, 'Login successful'));
  };

  logout = async (_request: AppRequest, reply: AppReply) => {
    const data = await this.authService.logout();
    reply.send(createSuccessResponse(data, 'Logout successful'));
  };

  heartbeat = async (request: AppRequest, reply: AppReply) => {
    await authenticate(request as AppRequest, reply as AppReply);
    reply.send(createSuccessResponse({ alive: true }, 'Heartbeat successful'));
  };

  resetDevice = async (request: AppRequest, reply: AppReply) => {
    const payload = bindSchema.parse(request.body);
    const data = await this.authService.resetDevice(payload.discordId);
    reply.send(createSuccessResponse(data, 'Device reset successfully'));
  };

  version = async (_request: AppRequest, reply: AppReply) => {
    reply.send(createSuccessResponse({ version: '1.0.0' }, 'Version fetched'));
  };

  notice = async (_request: AppRequest, reply: AppReply) => {
    reply.send(createSuccessResponse({ notice: 'System is operating normally.' }, 'Notice fetched'));
  };

  health = async (_request: AppRequest, reply: AppReply) => {
    reply.send(createSuccessResponse({ status: 'ok' }, 'Health check passed'));
  };
}

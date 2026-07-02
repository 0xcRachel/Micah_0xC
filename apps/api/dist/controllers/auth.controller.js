import { AuthService } from '../services/auth.service.js';
import { createSuccessResponse } from '@launcher/shared';
import { bindSchema, loginSchema, licenseCreateSchema, verifySchema } from '@launcher/shared';
import { authenticate } from '../middlewares/auth.js';
export class AuthController {
    authService;
    constructor(authService = new AuthService()) {
        this.authService = authService;
    }
    bind = async (request, reply) => {
        const payload = bindSchema.parse(request.body);
        const data = await this.authService.bindDevice(payload.discordId, payload.deviceId);
        reply.send(createSuccessResponse(data, 'Device bound successfully'));
    };
    createLicense = async (request, reply) => {
        const payload = licenseCreateSchema.parse(request.body);
        const data = await this.authService.createLicense(payload.discordId, payload.deviceId);
        reply.send(createSuccessResponse(data, 'License created successfully'));
    };
    verifyLicense = async (request, reply) => {
        const payload = verifySchema.parse(request.body);
        const data = await this.authService.verifyLicense(payload.licenseKey, payload.deviceId, payload.discordId);
        reply.send(createSuccessResponse({ valid: Boolean(data) }, 'License verified'));
    };
    login = async (request, reply) => {
        const payload = loginSchema.parse(request.body);
        const data = await this.authService.login(payload.discordId, payload.deviceId, payload.licenseKey);
        reply.send(createSuccessResponse(data, 'Login successful'));
    };
    logout = async (_request, reply) => {
        const data = await this.authService.logout();
        reply.send(createSuccessResponse(data, 'Logout successful'));
    };
    heartbeat = async (request, reply) => {
        await authenticate(request, reply);
        reply.send(createSuccessResponse({ alive: true }, 'Heartbeat successful'));
    };
    resetDevice = async (request, reply) => {
        const payload = bindSchema.parse(request.body);
        const data = await this.authService.resetDevice(payload.discordId);
        reply.send(createSuccessResponse(data, 'Device reset successfully'));
    };
    version = async (_request, reply) => {
        reply.send(createSuccessResponse({ version: '1.0.0' }, 'Version fetched'));
    };
    notice = async (_request, reply) => {
        reply.send(createSuccessResponse({ notice: 'System is operating normally.' }, 'Notice fetched'));
    };
    health = async (_request, reply) => {
        reply.send(createSuccessResponse({ status: 'ok' }, 'Health check passed'));
    };
}
//# sourceMappingURL=auth.controller.js.map
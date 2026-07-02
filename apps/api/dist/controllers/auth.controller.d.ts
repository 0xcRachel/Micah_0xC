import type { AppReply, AppRequest } from '../types/http.js';
import { AuthService } from '../services/auth.service.js';
export declare class AuthController {
    private readonly authService;
    constructor(authService?: AuthService);
    bind: (request: AppRequest, reply: AppReply) => Promise<void>;
    createLicense: (request: AppRequest, reply: AppReply) => Promise<void>;
    verifyLicense: (request: AppRequest, reply: AppReply) => Promise<void>;
    login: (request: AppRequest, reply: AppReply) => Promise<void>;
    logout: (_request: AppRequest, reply: AppReply) => Promise<void>;
    heartbeat: (request: AppRequest, reply: AppReply) => Promise<void>;
    resetDevice: (request: AppRequest, reply: AppReply) => Promise<void>;
    version: (_request: AppRequest, reply: AppReply) => Promise<void>;
    notice: (_request: AppRequest, reply: AppReply) => Promise<void>;
    health: (_request: AppRequest, reply: AppReply) => Promise<void>;
}

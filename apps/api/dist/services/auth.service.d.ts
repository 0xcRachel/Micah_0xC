import { UserRepository } from '../repositories/user.repository.js';
import { LicenseRepository } from '../repositories/license.repository.js';
export declare class AuthService {
    private readonly userRepository;
    private readonly licenseRepository;
    constructor(userRepository?: UserRepository, licenseRepository?: LicenseRepository);
    bindDevice(discordId: string, deviceId: string): Promise<{
        discordId: string;
        deviceId: string;
        verified: boolean;
    }>;
    createLicense(discordId: string, deviceId: string): Promise<{
        key: string;
        expiresAt: Date;
    }>;
    verifyLicense(licenseKey: string, deviceId: string, discordId: string): Promise<Record<string, unknown>>;
    login(discordId: string, deviceId: string, licenseKey: string): Promise<{
        token: string;
        expiresIn: string;
    }>;
    logout(): Promise<{
        success: boolean;
    }>;
    resetDevice(discordId: string): Promise<{
        reset: boolean;
    }>;
}

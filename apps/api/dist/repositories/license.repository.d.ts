export declare class LicenseRepository {
    findByKey(key: string): Promise<Record<string, unknown>>;
    create(input: {
        key: string;
        discordId: string;
        deviceId: string;
        expiresAt: Date;
    }): Promise<{
        key: string;
        discordId: string;
        deviceId: string;
        expiresAt: Date;
    }>;
    markUsed(key: string): Promise<{
        key: string;
    }>;
}

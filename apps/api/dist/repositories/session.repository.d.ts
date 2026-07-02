export declare class SessionRepository {
    create(input: {
        discordId: string;
        deviceId: string;
        licenseId: string;
        jwt: string;
    }): Promise<{
        discordId: string;
        deviceId: string;
        licenseId: string;
        jwt: string;
    }>;
}

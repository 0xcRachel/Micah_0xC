export declare class UserRepository {
    findByDiscordId(discordId: string): Promise<Record<string, unknown>>;
    create(input: {
        discordId: string;
        username: string;
        deviceId: string;
        verified: boolean;
    }): Promise<{
        discordId: string;
        username: string;
        deviceId: string;
        verified: boolean;
    }>;
    updateDevice(discordId: string, deviceId: string): Promise<{
        discordId: string;
        deviceId: string;
    }>;
    resetDevice(discordId: string): Promise<{
        discordId: string;
    }>;
}

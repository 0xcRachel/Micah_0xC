export declare class UserRepository {
    findByDiscordId(discordId: string): Promise<(import("mongoose").FlattenMaps<{
        discordId: string;
        username: string;
        deviceId: string;
        verified: boolean;
        createdAt: Date;
        updatedAt: Date;
    }> & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }) | null>;
    create(input: {
        discordId: string;
        username: string;
        deviceId: string;
        verified: boolean;
    }): Promise<import("mongoose").Document<unknown, {}, import("../models/user.model.js").IUser, {}, {}> & import("../models/user.model.js").IUser & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }>;
    updateDevice(discordId: string, deviceId: string): Promise<import("mongoose").UpdateWriteOpResult>;
    resetDevice(discordId: string): Promise<import("mongoose").UpdateWriteOpResult>;
}

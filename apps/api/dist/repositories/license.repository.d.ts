export declare class LicenseRepository {
    findByKey(key: string): Promise<(import("mongoose").FlattenMaps<{
        key: string;
        discordId: string;
        deviceId: string;
        issuedAt: Date;
        expiresAt: Date;
        revoked: boolean;
        used: boolean;
        createdAt: Date;
        updatedAt: Date;
    }> & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }) | null>;
    create(input: {
        key: string;
        discordId: string;
        deviceId: string;
        expiresAt: Date;
    }): Promise<import("mongoose").Document<unknown, {}, import("../models/license.model.js").ILicense, {}, {}> & import("../models/license.model.js").ILicense & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }>;
    markUsed(key: string): Promise<import("mongoose").UpdateWriteOpResult>;
}

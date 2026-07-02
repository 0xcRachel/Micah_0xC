export interface ILicense {
    key: string;
    discordId: string;
    deviceId: string;
    issuedAt: Date;
    expiresAt: Date;
    revoked: boolean;
    used: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export declare const LicenseModel: import("mongoose").Model<ILicense, {}, {}, {}, import("mongoose").Document<unknown, {}, ILicense, {}, {}> & ILicense & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}, any>;

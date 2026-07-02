export interface ILicense {
    id?: number;
    key: string;
    discordId: string;
    deviceId: string;
    issuedAt?: Date;
    expiresAt: Date;
    revoked: boolean;
    used: boolean;
    createdAt?: Date;
    updatedAt?: Date;
}

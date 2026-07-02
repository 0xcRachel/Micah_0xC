export interface ISession {
    discordId: string;
    deviceId: string;
    licenseId: string;
    jwt: string;
    createdAt: Date;
    updatedAt: Date;
}
export declare const SessionModel: import("mongoose").Model<ISession, {}, {}, {}, import("mongoose").Document<unknown, {}, ISession, {}, {}> & ISession & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}, any>;

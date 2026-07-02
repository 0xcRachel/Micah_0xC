import { model, Schema } from 'mongoose';

export interface ISession {
  discordId: string;
  deviceId: string;
  licenseId: string;
  jwt: string;
  createdAt: Date;
  updatedAt: Date;
}

const sessionSchema = new Schema<ISession>({
  discordId: { type: String, required: true, index: true },
  deviceId: { type: String, required: true },
  licenseId: { type: String, required: true },
  jwt: { type: String, required: true },
}, { timestamps: true });

export const SessionModel = model<ISession>('Session', sessionSchema);

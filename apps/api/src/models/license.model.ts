import { model, Schema } from 'mongoose';

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

const licenseSchema = new Schema<ILicense>({
  key: { type: String, required: true, unique: true, index: true },
  discordId: { type: String, required: true, index: true },
  deviceId: { type: String, required: true, index: true },
  issuedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
  revoked: { type: Boolean, default: false },
  used: { type: Boolean, default: false },
}, { timestamps: true });

export const LicenseModel = model<ILicense>('License', licenseSchema);

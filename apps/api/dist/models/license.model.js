import { model, Schema } from 'mongoose';
const licenseSchema = new Schema({
    key: { type: String, required: true, unique: true, index: true },
    discordId: { type: String, required: true, index: true },
    deviceId: { type: String, required: true, index: true },
    issuedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
    revoked: { type: Boolean, default: false },
    used: { type: Boolean, default: false },
}, { timestamps: true });
export const LicenseModel = model('License', licenseSchema);
//# sourceMappingURL=license.model.js.map
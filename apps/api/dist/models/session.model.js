import { model, Schema } from 'mongoose';
const sessionSchema = new Schema({
    discordId: { type: String, required: true, index: true },
    deviceId: { type: String, required: true },
    licenseId: { type: String, required: true },
    jwt: { type: String, required: true },
}, { timestamps: true });
export const SessionModel = model('Session', sessionSchema);
//# sourceMappingURL=session.model.js.map
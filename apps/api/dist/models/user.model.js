import { model, Schema } from 'mongoose';
const userSchema = new Schema({
    discordId: { type: String, required: true, unique: true, index: true },
    username: { type: String, required: true },
    deviceId: { type: String, required: true },
    verified: { type: Boolean, default: false },
}, { timestamps: true });
export const UserModel = model('User', userSchema);
//# sourceMappingURL=user.model.js.map
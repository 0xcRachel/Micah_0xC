import { model, Schema } from 'mongoose';

export interface IUser {
  discordId: string;
  username: string;
  deviceId: string;
  verified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>({
  discordId: { type: String, required: true, unique: true, index: true },
  username: { type: String, required: true },
  deviceId: { type: String, required: true },
  verified: { type: Boolean, default: false },
}, { timestamps: true });

export const UserModel = model<IUser>('User', userSchema);

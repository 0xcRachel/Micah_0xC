import { UserModel } from '../models/user.model.js';

export class UserRepository {
  async findByDiscordId(discordId: string) {
    return UserModel.findOne({ discordId }).lean();
  }

  async create(input: { discordId: string; username: string; deviceId: string; verified: boolean }) {
    return UserModel.create(input);
  }

  async updateDevice(discordId: string, deviceId: string) {
    return UserModel.updateOne({ discordId }, { deviceId, verified: true }).lean();
  }

  async resetDevice(discordId: string) {
    return UserModel.updateOne({ discordId }, { deviceId: '', verified: false }).lean();
  }
}

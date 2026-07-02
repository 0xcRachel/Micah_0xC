import { UserModel } from '../models/user.model.js';
export class UserRepository {
    async findByDiscordId(discordId) {
        return UserModel.findOne({ discordId }).lean();
    }
    async create(input) {
        return UserModel.create(input);
    }
    async updateDevice(discordId, deviceId) {
        return UserModel.updateOne({ discordId }, { deviceId, verified: true }).lean();
    }
    async resetDevice(discordId) {
        return UserModel.updateOne({ discordId }, { deviceId: '', verified: false }).lean();
    }
}
//# sourceMappingURL=user.repository.js.map
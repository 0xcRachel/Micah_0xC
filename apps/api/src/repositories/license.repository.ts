import { LicenseModel } from '../models/license.model.js';

export class LicenseRepository {
  async findByKey(key: string) {
    return LicenseModel.findOne({ key }).lean();
  }

  async create(input: { key: string; discordId: string; deviceId: string; expiresAt: Date }) {
    return LicenseModel.create(input);
  }

  async markUsed(key: string) {
    return LicenseModel.updateOne({ key }, { used: true }).lean();
  }
}

import { LicenseModel } from '../models/license.model.js';
export class LicenseRepository {
    async findByKey(key) {
        return LicenseModel.findOne({ key }).lean();
    }
    async create(input) {
        return LicenseModel.create(input);
    }
    async markUsed(key) {
        return LicenseModel.updateOne({ key }, { used: true }).lean();
    }
}
//# sourceMappingURL=license.repository.js.map
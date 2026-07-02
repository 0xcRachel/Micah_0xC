import { mysqlPool } from '../plugins/mysql.js';
export class LicenseRepository {
    async findByKey(key) {
        const [rows] = await mysqlPool.execute('SELECT * FROM licenses WHERE license_key = ? LIMIT 1', [key]);
        return rows[0] ?? null;
    }
    async create(input) {
        await mysqlPool.execute('INSERT INTO licenses (license_key, discord_id, device_id, expires_at, revoked, used) VALUES (?, ?, ?, ?, 0, 0)', [input.key, input.discordId, input.deviceId, input.expiresAt]);
        return { ...input };
    }
    async markUsed(key) {
        await mysqlPool.execute('UPDATE licenses SET used = 1 WHERE license_key = ?', [key]);
        return { key };
    }
}
//# sourceMappingURL=license.repository.js.map
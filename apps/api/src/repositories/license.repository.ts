import { mysqlPool } from '../plugins/mysql.js';

export class LicenseRepository {
  async findByKey(key: string) {
    const [rows] = await mysqlPool.execute('SELECT * FROM licenses WHERE license_key = ? LIMIT 1', [key]);
    return (rows as Array<Record<string, unknown>>)[0] ?? null;
  }

  async create(input: { key: string; discordId: string; deviceId: string; expiresAt: Date }) {
    await mysqlPool.execute(
      'INSERT INTO licenses (license_key, discord_id, device_id, expires_at, revoked, used) VALUES (?, ?, ?, ?, 0, 0)',
      [input.key, input.discordId, input.deviceId, input.expiresAt],
    );
    return { ...input };
  }

  async markUsed(key: string) {
    await mysqlPool.execute('UPDATE licenses SET used = 1 WHERE license_key = ?', [key]);
    return { key };
  }
}

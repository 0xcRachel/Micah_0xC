import { mysqlPool } from '../plugins/mysql.js';

export class SessionRepository {
  async create(input: { discordId: string; deviceId: string; licenseId: string; jwt: string }) {
    await mysqlPool.execute(
      'INSERT INTO sessions (discord_id, device_id, license_id, jwt) VALUES (?, ?, ?, ?)',
      [input.discordId, input.deviceId, input.licenseId, input.jwt],
    );
    return { ...input };
  }
}

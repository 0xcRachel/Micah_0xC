import { mysqlPool } from '../plugins/mysql.js';

export class UserRepository {
  async findByDiscordId(discordId: string) {
    const [rows] = await mysqlPool.execute('SELECT * FROM users WHERE discord_id = ? LIMIT 1', [discordId]);
    return (rows as Array<Record<string, unknown>>)[0] ?? null;
  }

  async create(input: { discordId: string; username: string; deviceId: string; verified: boolean }) {
    await mysqlPool.execute(
      'INSERT INTO users (discord_id, username, device_id, verified) VALUES (?, ?, ?, ?)',
      [input.discordId, input.username, input.deviceId, input.verified ? 1 : 0],
    );
    return { ...input };
  }

  async updateDevice(discordId: string, deviceId: string) {
    await mysqlPool.execute('UPDATE users SET device_id = ?, verified = 1 WHERE discord_id = ?', [deviceId, discordId]);
    return { discordId, deviceId };
  }

  async resetDevice(discordId: string) {
    await mysqlPool.execute('UPDATE users SET device_id = NULL, verified = 0 WHERE discord_id = ?', [discordId]);
    return { discordId };
  }
}

import { mysqlPool } from '../plugins/mysql.js';
export class SessionRepository {
    async create(input) {
        await mysqlPool.execute('INSERT INTO sessions (discord_id, device_id, license_id, jwt) VALUES (?, ?, ?, ?)', [input.discordId, input.deviceId, input.licenseId, input.jwt]);
        return { ...input };
    }
}
//# sourceMappingURL=session.repository.js.map
import mysql from 'mysql2/promise';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
export const mysqlPool = mysql.createPool({
    host: env.MYSQL_HOST,
    port: env.MYSQL_PORT,
    user: env.MYSQL_USER,
    password: env.MYSQL_PASSWORD,
    database: env.MYSQL_DATABASE,
    waitForConnections: true,
    connectionLimit: env.MYSQL_CONNECTION_LIMIT,
    queueLimit: 0,
});
export async function connectDatabase() {
    const connection = await mysqlPool.getConnection();
    try {
        await connection.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        discord_id VARCHAR(255) NOT NULL UNIQUE,
        username VARCHAR(255) NOT NULL,
        device_id VARCHAR(255) NULL,
        verified TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
        await connection.execute(`
      CREATE TABLE IF NOT EXISTS licenses (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        license_key VARCHAR(255) NOT NULL UNIQUE,
        discord_id VARCHAR(255) NOT NULL,
        device_id VARCHAR(255) NOT NULL,
        issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL,
        revoked TINYINT(1) NOT NULL DEFAULT 0,
        used TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
        await connection.execute(`
      CREATE TABLE IF NOT EXISTS sessions (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        discord_id VARCHAR(255) NOT NULL,
        device_id VARCHAR(255) NOT NULL,
        license_id VARCHAR(255) NOT NULL,
        jwt TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
        await connection.execute(`
      CREATE TABLE IF NOT EXISTS app (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        version VARCHAR(50) NOT NULL,
        notice TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
        await connection.execute(`
      CREATE TABLE IF NOT EXISTS logs (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        level VARCHAR(50) NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    }
    finally {
        connection.release();
    }
    logger.info('MySQL connected');
}
//# sourceMappingURL=mysql.js.map
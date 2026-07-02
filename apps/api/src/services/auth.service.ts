import jwt, { type SignOptions } from 'jsonwebtoken';
import { AppError } from '../errors/app-error.js';
import { UserRepository } from '../repositories/user.repository.js';
import { LicenseRepository } from '../repositories/license.repository.js';
import { HTTP_CODES } from '@launcher/shared';
import { env } from '../config/env.js';
import type { JwtPayload } from '@launcher/shared';

export class AuthService {
  constructor(
    private readonly userRepository = new UserRepository(),
    private readonly licenseRepository = new LicenseRepository(),
  ) {}

  async bindDevice(discordId: string, deviceId: string) {
    const existing = await this.userRepository.findByDiscordId(discordId);
    if (existing && existing.deviceId && existing.deviceId !== deviceId) {
      throw new AppError(HTTP_CODES.CONFLICT, 409, 'Device already bound to another device');
    }

    await this.userRepository.updateDevice(discordId, deviceId);
    return { discordId, deviceId, verified: true };
  }

  async createLicense(discordId: string, deviceId: string) {
    const user = await this.userRepository.findByDiscordId(discordId);
    const userDeviceId = typeof user?.device_id === 'string' ? user.device_id : null;
    if (!user || userDeviceId !== deviceId) {
      throw new AppError(HTTP_CODES.UNAUTHORIZED, 401, 'Device not bound');
    }

    const key = `LIC-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const license = await this.licenseRepository.create({ key, discordId, deviceId, expiresAt });

    return { key, expiresAt: license.expiresAt };
  }

  async verifyLicense(licenseKey: string, deviceId: string, discordId: string) {
    const license = await this.licenseRepository.findByKey(licenseKey);
    const revoked = typeof license?.revoked === 'number' ? Boolean(license.revoked) : Boolean(license?.revoked);
    const used = typeof license?.used === 'number' ? Boolean(license.used) : Boolean(license?.used);
    if (!license || revoked || used) {
      throw new AppError(HTTP_CODES.UNAUTHORIZED, 401, 'Invalid or used license');
    }

    const rowDeviceId = typeof license.device_id === 'string' ? license.device_id : '';
    const rowDiscordId = typeof license.discord_id === 'string' ? license.discord_id : '';
    if (rowDeviceId !== deviceId || rowDiscordId !== discordId) {
      throw new AppError(HTTP_CODES.UNAUTHORIZED, 401, 'License does not match device or Discord account');
    }

    const expiresAt = typeof license.expires_at === 'string' || license.expires_at instanceof Date
      ? new Date(license.expires_at)
      : new Date();
    if (expiresAt < new Date()) {
      throw new AppError(HTTP_CODES.UNAUTHORIZED, 401, 'License expired');
    }

    return license;
  }

  async login(discordId: string, deviceId: string, licenseKey: string) {
    const license = await this.verifyLicense(licenseKey, deviceId, discordId);
    const licenseKeyValue = typeof license?.license_key === 'string' ? license.license_key : '';
    await this.licenseRepository.markUsed(licenseKeyValue);

    const payload: JwtPayload = {
      discordId,
      deviceId,
      licenseId: licenseKeyValue,
    };

    const options: SignOptions = { expiresIn: env.JWT_EXPIRE as SignOptions['expiresIn'] };
    const token = jwt.sign(payload, env.JWT_SECRET, options);
    return { token, expiresIn: env.JWT_EXPIRE };
  }

  async logout() {
    return { success: true };
  }

  async resetDevice(discordId: string) {
    await this.userRepository.resetDevice(discordId);
    return { reset: true };
  }
}

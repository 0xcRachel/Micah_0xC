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
    if (!user || user.deviceId !== deviceId) {
      throw new AppError(HTTP_CODES.UNAUTHORIZED, 401, 'Device not bound');
    }

    const key = `LIC-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const license = await this.licenseRepository.create({ key, discordId, deviceId, expiresAt });

    return { key, expiresAt: license.expiresAt };
  }

  async verifyLicense(licenseKey: string, deviceId: string, discordId: string) {
    const license = await this.licenseRepository.findByKey(licenseKey);
    if (!license || license.revoked || license.used) {
      throw new AppError(HTTP_CODES.UNAUTHORIZED, 401, 'Invalid or used license');
    }

    if (license.deviceId !== deviceId || license.discordId !== discordId) {
      throw new AppError(HTTP_CODES.UNAUTHORIZED, 401, 'License does not match device or Discord account');
    }

    if (new Date(license.expiresAt) < new Date()) {
      throw new AppError(HTTP_CODES.UNAUTHORIZED, 401, 'License expired');
    }

    return license;
  }

  async login(discordId: string, deviceId: string, licenseKey: string) {
    const license = await this.verifyLicense(licenseKey, deviceId, discordId);
    await this.licenseRepository.markUsed(license.key);

    const payload: JwtPayload = {
      discordId,
      deviceId,
      licenseId: license.key,
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

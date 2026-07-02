import { z } from 'zod';
export const bindSchema = z.object({
    deviceId: z.string().min(3),
    discordId: z.string().min(3),
});
export const loginSchema = z.object({
    deviceId: z.string().min(3),
    discordId: z.string().min(3),
    licenseKey: z.string().min(3),
});
export const licenseCreateSchema = z.object({
    discordId: z.string().min(3),
    deviceId: z.string().min(3),
});
export const verifySchema = z.object({
    licenseKey: z.string().min(3),
    deviceId: z.string().min(3),
    discordId: z.string().min(3),
});

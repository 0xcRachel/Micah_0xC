import { z } from 'zod';
export declare const bindSchema: z.ZodObject<{
    deviceId: z.ZodString;
    discordId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    deviceId: string;
    discordId: string;
}, {
    deviceId: string;
    discordId: string;
}>;
export declare const loginSchema: z.ZodObject<{
    deviceId: z.ZodString;
    discordId: z.ZodString;
    licenseKey: z.ZodString;
}, "strip", z.ZodTypeAny, {
    deviceId: string;
    discordId: string;
    licenseKey: string;
}, {
    deviceId: string;
    discordId: string;
    licenseKey: string;
}>;
export declare const licenseCreateSchema: z.ZodObject<{
    discordId: z.ZodString;
    deviceId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    deviceId: string;
    discordId: string;
}, {
    deviceId: string;
    discordId: string;
}>;
export declare const verifySchema: z.ZodObject<{
    licenseKey: z.ZodString;
    deviceId: z.ZodString;
    discordId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    deviceId: string;
    discordId: string;
    licenseKey: string;
}, {
    deviceId: string;
    discordId: string;
    licenseKey: string;
}>;
export type BindPayload = z.infer<typeof bindSchema>;
export type LoginPayload = z.infer<typeof loginSchema>;
export type LicenseCreatePayload = z.infer<typeof licenseCreateSchema>;
export type VerifyPayload = z.infer<typeof verifySchema>;

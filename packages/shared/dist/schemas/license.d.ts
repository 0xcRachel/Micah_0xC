import { z } from 'zod';
export declare const licenseStatusSchema: z.ZodObject<{
    isValid: z.ZodBoolean;
    expiresAt: z.ZodOptional<z.ZodDate>;
}, "strip", z.ZodTypeAny, {
    isValid: boolean;
    expiresAt?: Date | undefined;
}, {
    isValid: boolean;
    expiresAt?: Date | undefined;
}>;
export type LicenseStatus = z.infer<typeof licenseStatusSchema>;

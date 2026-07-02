import { z } from 'zod';
export const licenseStatusSchema = z.object({
    isValid: z.boolean(),
    expiresAt: z.date().optional(),
});

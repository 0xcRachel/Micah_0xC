import { z } from 'zod';
export declare const ApiResponseSchema: z.ZodObject<{
    success: z.ZodBoolean;
    code: z.ZodNumber;
    message: z.ZodString;
    data: z.ZodOptional<z.ZodUnknown>;
}, "strip", z.ZodTypeAny, {
    success: boolean;
    code: number;
    message: string;
    data?: unknown;
}, {
    success: boolean;
    code: number;
    message: string;
    data?: unknown;
}>;
export type ApiResponse = z.infer<typeof ApiResponseSchema>;

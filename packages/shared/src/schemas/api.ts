import { z } from 'zod';

export const ApiResponseSchema = z.object({
  success: z.boolean(),
  code: z.number(),
  message: z.string(),
  data: z.unknown().optional(),
});

export type ApiResponse = z.infer<typeof ApiResponseSchema>;

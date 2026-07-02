import dotenv from 'dotenv';
import { z } from 'zod';
dotenv.config();
const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().default(3000),
    HOST: z.string().default('0.0.0.0'),
    MONGODB_URI: z.string().min(1),
    JWT_SECRET: z.string().min(1),
    JWT_EXPIRE: z.string().default('7d'),
    CLIENT_URL: z.string().default('http://localhost:1420'),
    API_PREFIX: z.string().default('/api/v1'),
    LOG_LEVEL: z.string().default('info'),
});
export const env = envSchema.parse(process.env);
//# sourceMappingURL=env.js.map
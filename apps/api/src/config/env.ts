import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),
  MYSQL_HOST: z.string().default('127.0.0.1'),
  MYSQL_PORT: z.coerce.number().default(3306),
  MYSQL_USER: z.string().default('root'),
  MYSQL_PASSWORD: z.string().default(''),
  MYSQL_DATABASE: z.string().default('launcher'),
  MYSQL_CONNECTION_LIMIT: z.coerce.number().default(10),
  JWT_SECRET: z.string().min(1),
  JWT_EXPIRE: z.string().default('7d'),
  CLIENT_URL: z.string().default('http://localhost:1420'),
  API_PREFIX: z.string().default('/api/v1'),
  LOG_LEVEL: z.string().default('info'),
});

export const env = envSchema.parse(process.env);

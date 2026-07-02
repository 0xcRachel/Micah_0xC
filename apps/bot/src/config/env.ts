import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  DISCORD_TOKEN: z.string().min(1),
  CLIENT_ID: z.string().min(1),
  GUILD_ID: z.string().min(1),
  API_URL: z.string().url().default('http://localhost:3000/api/v1'),
});

export const env = envSchema.parse(process.env);

import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
export async function connectDatabase() {
    await mongoose.connect(env.MONGODB_URI);
    logger.info('MongoDB connected');
}
//# sourceMappingURL=mongo.js.map
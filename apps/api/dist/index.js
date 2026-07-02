import Fastify from 'fastify';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { connectDatabase } from './plugins/mysql.js';
import { errorHandler } from './middlewares/error-handler.js';
import { authRoutes } from './routes/auth.routes.js';
// The API is the single authority for auth, licenses, and device state.
// All other services must call it rather than reaching the database directly.
const app = Fastify({
    logger,
    disableRequestLogging: false,
});
app.register(authRoutes, { prefix: env.API_PREFIX });
app.setErrorHandler(errorHandler);
async function start() {
    await connectDatabase();
    app.listen({ port: env.PORT, host: env.HOST }, (error, address) => {
        if (error) {
            logger.error(error, 'Failed to start API server');
            process.exit(1);
        }
        logger.info({ address }, 'API server started');
    });
}
start().catch((error) => {
    logger.error(error, 'Startup failed');
    process.exit(1);
});
process.on('SIGINT', async () => {
    logger.info('Shutting down API server');
    await app.close();
    process.exit(0);
});
//# sourceMappingURL=index.js.map
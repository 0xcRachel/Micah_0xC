# Architecture Overview

## Goals

- Keep the API as the single gateway for authentication, licensing, and device binding.
- Ensure the Discord bot never touches MySQL directly.
- Enforce validation and consistent response envelopes through shared schemas and services.

## Layers

### API
- Fastify instance boots from [apps/api/src/index.ts](apps/api/src/index.ts)
- Routes are defined in [apps/api/src/routes/auth.routes.ts](apps/api/src/routes/auth.routes.ts)
- Controllers delegate to services in [apps/api/src/services/auth.service.ts](apps/api/src/services/auth.service.ts)
- Repositories isolate database access in [apps/api/src/repositories](apps/api/src/repositories)
- Mongoose models live in [apps/api/src/models](apps/api/src/models)

### Bot
- Bot bootstrap is in [apps/bot/src/index.ts](apps/bot/src/index.ts)
- Slash commands invoke the API through [apps/bot/src/services/api-client.ts](apps/bot/src/services/api-client.ts)

### Shared
- Shared schemas live in [packages/shared/src/schemas](packages/shared/src/schemas)
- Shared response helpers live in [packages/shared/src/utils/response.ts](packages/shared/src/utils/response.ts)

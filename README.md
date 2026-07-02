
# Launcher Monorepo

This workspace contains a production-oriented monorepo scaffold for a desktop launcher with:
- a Fastify API acting as the only gateway to MongoDB
- a Discord bot that calls the API for binding, licensing, and auth workflows
- shared TypeScript contracts and schemas for consistency

## Structure

- apps/api — Fastify backend with MongoDB, JWT auth, validation, logging, and health endpoints
- apps/bot — Discord.js bot with slash commands for /bind, /getkey, /profile, /reset-device, and /help
- packages/shared — shared schemas, HTTP constants, response helpers, and common types

## Getting started

1. Install dependencies:
   - pnpm install
2. Configure environment files:
   - apps/api/.env.example -> apps/api/.env
   - apps/bot/.env.example -> apps/bot/.env
3. Start the API:
   - pnpm dev:api
4. Start the bot:
   - pnpm dev:bot

## Architecture notes

- The API is the only service that can access MongoDB.
- The Discord bot never talks to MongoDB directly.
- All request validation uses Zod.
- The API returns a consistent success/error envelope.
- The core flow includes device binding, license issuance, verification, and JWT-backed login.

## Endpoint summary

- POST /bind
- POST /license/create
- POST /license/verify
- POST /login
- POST /logout
- POST /heartbeat
- POST /device/reset
- GET /version
- GET /notice
- GET /health

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md)

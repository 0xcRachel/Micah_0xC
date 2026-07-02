
<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/icon.png">
    <img src="assets/icon.png" width="220" alt="">
  </picture>
</p>

<h1 align="center">0xcLaucher</h1>

<p align="center">
  <sub>0xC Launcher, built on ultra-light Tauri, can quickly access Steam’s appmanifest_*.acf files, slashing manifest retrieval time for optimal game library integration. Its Device Binding mechanism (stable, hardware-independent IDs) allows saving installed game states as local snapshots – acting as a built‑in backup. When SteamTools fails and wipes your games, the launcher restores the correct manifest and re‑attaches the game to Steam in seconds, ensuring you never lose data or need to re‑download.</sub>
</p>

<hr>

# 0xC Launcher — A Desktop Launcher with License Management, Discord Auth & Device Binding

> This document explains the architecture, value, and reasons you might consider using — or drawing inspiration from — **0xC Launcher** as the foundation for your own launcher product.

---

## 1. What problem does this project solve?

If you've ever built a desktop application that needs to **sell keys, control which devices can use it, or manage users through Discord**, you've likely run into the same recurring problems:

- How do you authenticate users without building an entire account/password system from scratch?
- How do you make sure one license can't be shared across multiple machines?
- How do you force users to update to the latest version, avoiding bugs or security holes in old builds?
- How do you manage the full lifecycle of a license (issuing, expiration, revocation) safely?

**0xC Launcher** is built to answer exactly these questions with a clear, well-separated architecture that can grow over time — instead of stitching together ad-hoc solutions for each piece.

---

## 2. Overall architecture — why it's trustworthy

```
                    MongoDB
                        │
        ┌───────────────┴───────────────┐
        │                               │
    Discord Bot                   Admin Panel (future)
        │
        ▼
      Fastify API
        │
        ▼
    Tauri Desktop App
```

The key idea behind this architecture is that **no client — neither the App nor the Bot — ever touches the database directly**. Everything goes through a central API layer (Fastify). This is a basic but crucial security principle:

- No client holds secrets or a database connection.
- Every authentication decision (login, license verification, device check) happens on the server, where you fully control the logic.
- Even if the App or Bot is reverse-engineered, an attacker still can't talk to MongoDB directly.

In other words, the project applies a proper **zero-trust-at-the-client** mindset — something a lot of self-made launchers (especially key-selling tools for games/utilities) tend to skip.

---

## 3. Tech stack — why these choices make sense

| Component | Technology | Why it fits |
|---|---|---|
| Desktop Client | **Tauri** + React + TypeScript + Vite | Tauri produces much lighter binaries than Electron, uses far less RAM, and packages natively — great for a launcher that needs to start fast |
| UI | TailwindCSS + Framer Motion | Build a modern UI with smooth animations without hand-writing CSS |
| Backend | Node.js + Fastify + TypeScript | Fastify is faster than Express and has strong type safety — good for APIs with high call frequency (heartbeat, repeated verification) |
| Database | MongoDB | Flexible schema, well suited to license/device data whose shape may evolve over time |
| Bot | discord.js | Leverages Discord as a ready-made authentication layer, so you don't have to build your own registration/login system |

The **monorepo** structure (`apps/client`, `apps/api`, `apps/bot`, `packages/shared`) is another notable architectural choice: types, constants, and schemas are **shared** between the API and the Bot, which greatly reduces data drift — a very common bug when two services are written as separate, disconnected codebases.

---

## 4. Operational flow — the end-user experience

This project delivers a **seamless user journey with no need for a separate account system**:

1. **First launch** → the App automatically generates a unique **Device ID** and displays it for the user to copy.
2. **Linking Discord** → the user runs `/bind DEVICE_ID` in Discord → the Bot calls the API → the data is stored in MongoDB → the device is verified.
3. **Getting a license** → running `/getkey` triggers a check that the device is already bound before a new license is issued.
4. **Logging into the App** → the system checks all of the following at once: valid license, matching Discord account, matching device, not expired, and correct app version.

The real-world payoff here: **users never need to remember another password**. Authentication is built entirely on the Discord account they already have — which significantly reduces onboarding friction.

---

## 5. Device Binding — a notable differentiator

Many other launchers use **raw HWID** (pulled from the CPU, motherboard, or SSD serial number) to lock a license to a device. This approach has a major downside: swapping a hard drive, adding RAM, or updating the BIOS can change the HWID, leading to a flood of support complaints.

0xC Launcher instead uses a **Device ID generated on first run**, independent of hardware:

- Not tied to CPU/SSD/motherboard.
- More stable over time.
- Easy to manage and reset when needed (`/reset-device`).

The original documentation also states an important security principle explicitly: **Device ID is only a device-management mechanism, not the sole security layer** — a sound mindset that avoids treating it as a silver bullet.

---

## 6. License policy — tight control, less leakage

- Each license is valid for **only one device**.
- Short lifespan: **3 days**, after which a brand-new license must be issued (no renewals).

This design directly tackles the biggest headache of key-selling models: **one purchase shared among many users**. Because licenses are short-lived and tightly bound to a device, sharing a license becomes practically pointless — a clear benefit for whoever runs the project, in terms of both revenue and user control.

---

## 7. Version control & Force Update

Every time the app opens, the client calls `GET /version`. If the current version is lower than required, the server responds accordingly and the app will:

- Lock all functionality.
- Show an update screen.
- Block login until the update is installed.

This mechanism is extremely useful when you need to **patch a critical security issue** or **change the API protocol** without having multiple outdated client versions causing data conflicts.

---

## 8. Overall benefits of this project

| Benefit | Why it matters |
|---|---|
| **No need to build a separate account system** | Leverages a Discord-based auth flow via the bot, saving significant development time |
| **Clear layered architecture** (Client / API / Bot / DB) | Easier to maintain, scale each part independently, and onboard new developers |
| **Security based on "the server decides everything"** | Reduces the risk of license bypass through client reverse-engineering |
| **Hardware-independent Device Binding** | Fewer user complaints, easier operational management |
| **Short-lived, non-reusable licenses** | Limits unauthorized license sharing/resale |
| **Centralized Force Update** | Ensures all users are running a known, safe version |
| **Monorepo + shared package** | Keeps types/schemas in sync across services, reducing runtime errors |
| **Clear 6-phase roadmap** | Easy to track progress and, if open-sourced, easy for contributors to know where to plug in |

---

## 9. Who should care about this project?

- **Teams building commercial tools/launchers** who need a licensing system without designing one from scratch.
- **Discord-first communities** (game servers, community tools) who want to use Discord itself as the authentication layer.
- **Developers learning system architecture** — this is a compact but complete case study: authentication, licensing, versioning, and security boundaries are all clearly demonstrated in a project small enough to read end-to-end.

---

## 10. Summary

0xC Launcher is more than just a simple "key-selling" launcher — it's a **solid reference architecture** for the problem of passwordless authentication via Discord, secure device management, tight license lifecycle control, and enforced version updates. By clearly separating Client, API, Bot, and Database, and following the principle that "the server is always the single source of truth," the project provides a strong, extensible foundation (Admin Panel, Auto Update, Dashboard planned in later phases) without sacrificing security or long-term maintainability.

## Contributor
<a href="https://github.com/0xcRachel/MUSOU_DASH/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=0xcRachel/MUSOU_DASH" alt="Contributors" />
</a>

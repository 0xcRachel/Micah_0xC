
<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="src-tauri/icons/icon.png">
    <img src="/AppLications/src-tauri/icons/icon.png" width="220" alt="">
  </picture>
</p>

<h1 align="center">Micah 0xC</h1>

<p align="center">
  <sub>A fast, lightweight desktop companion for managing your game library and Steam experience — built on Tauri + React. Search games, inspect ratings &amp; system requirements, monitor your PC, manage Steam integration, and auto-download &amp; import Lua scripts without restarting Steam.</sub>
</p>

<hr>

# Micah 0xC — Game Library Manager & Steam Companion

> A modern Windows desktop app that keeps game discovery, system diagnostics, Steam management, and Lua script workflows in one place. Small binary, low RAM, smooth animations.

---

## Features

### Game Search & Discovery
- Search games by name (Steam store API).
- Rich detail view — score ring, developer, price, tags.
- Lightbox modal with **game features, categories, and system requirements** (minimum & recommended, rendered from raw Steam HTML).

### System Diagnostics
- Live **System Info Card**: CPU, RAM, GPU, OS, and more — right on the home screen.

### Favorites / Like Page
- Save the games you care about and revisit them instantly.

### Steam Manager
A dedicated panel with 5 tabs:

| Tab | What it does |
| --- | --- |
| **Status** | DLL integration state — Loaded / Not Loaded / Steam Off / Verify Failed |
| **Games** | List managed games, enable/disable per game |
| **Logs** | Read activity logs to debug issues |
| **Settings** | Configure integration behavior |
| **Updater** | Check & apply the latest app release |

- Auto-detect or manually select your Steam directory.
- Install / remove integration DLLs.

### Lua Script Auto-Download & Auto-Import
- One-click download of Lua scripts from the **Manifest Hub** (GitHub).
- Automatically saved into a dedicated `lua_scripts` folder under the app data directory, named `<AppID>_<Game>.lua`.
- Automatically imported into Steam's Lua directory and registered in `micah_mode.toml` `[lua] paths`.
- **Hot-reloads — no Steam restart required.**
- Toast notifications with in/out animations confirm success or failure.

### Updates & Maintenance
- Force / optional update screens with release notes.
- Multiple update channels.
- Multi-domain GitHub resolution with DNS latency probing for flaky networks.

### UI / UX
- Dark & light mode with a consistent accent color system.
- GSAP-powered transitions (circular page transition, entrance animations).
- Interactive chibi character that opens quick actions.
- Portal-based toast notifications that never get hidden behind modals.

---

## Tech Stack

| Component | Technology | Why |
| --- | --- | --- |
| Desktop shell | **Tauri 2** (Rust) | Tiny binaries, low memory, native performance |
| Frontend | **React 19** + **Rsbuild** | Fast builds, modern DX |
| Animations | **GSAP** (+ ScrollTrigger/useGSAP) | Smooth, high-performance motion |
| Backend commands | **Rust** (Tauri commands) | `reqwest` for GitHub/Steam APIs, TOML config management |
| Packaging | **MSI + NSIS** | Professional Windows installers |

Current version: **0.6.0**

---

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org) (LTS recommended)
- [Rust](https://www.rust-lang.org/tools/install) toolchain
- [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) (Microsoft C++ Build Tools, WebView2)

### Install dependencies
```bash
npm install
```

### Run in development (hot reload)
```bash
npm run dev
```
The app loads at `http://localhost:3000` via Rsbuild and launches in a Tauri window with hot reload.

### Build the frontend only
```bash
npm run build
```

### Build the production desktop app (MSI + NSIS)
```bash
npx tauri build
```
Output:
- `src-tauri/target/release/micah0xc.exe`
- `src-tauri/target/release/bundle/msi/Micah_0xC_<ver>_x64_en-US.msi`
- `src-tauri/target/release/bundle/nsis/Micah_0xC_<ver>_x64-setup.exe`

### Preview the production frontend
```bash
npm run preview
```

---

## Project Structure

```
AppLications/
├── src/                    # React frontend
│   ├── App.jsx             # Root app, page routing, theme
│   ├── api.ts              # Typed wrappers for Tauri commands
│   ├── components/         # ProfileCard, SearchGame, SteamManager, Toast, ...
│   ├── pages/              # SettingsPage, LikePage
│   └── styles/             # Global CSS (Toast, etc.)
├── public/                 # Static assets (favicon, images)
├── src-tauri/              # Tauri shell + Rust backend
│   ├── src/
│   │   ├── lib.rs          # Command registration, setup, window management
│   │   └── manager.rs      # Steam dir detection, DLL management, Lua import
│   ├── icons/              # App icons (ICO/ICNS/PNG/iOS/Android)
│   └── tauri.conf.json     # App config, bundling, updater
└── PR_MARKETING.md         # Marketing / landing-page copy pack
```

---

## Architecture Notes

- **`manager.rs`** is the core domain layer — everything from Steam directory detection, DLL install/remove/scan, to the Lua auto-import pipeline.
- **Lua auto-import** (`auto_save_and_import_lua`):
  1. Fetches `.lua` files from the Manifest Hub repo (GitHub contents API, branch `ref=<appid>`).
  2. Saves into `<app_data_dir>/lua_scripts/<AppID>_<Game>.lua`.
  3. Copies into Steam's Lua directory (`<Steam>/config/lua/<AppID>.lua`) for the DLL's file watcher.
  4. Registers the folder in `micah_mode.toml` `[lua] paths` — done with a surgical TOML edit that preserves all other sections.
- **Config updates** use targeted string edits instead of rewriting the whole TOML, so user settings are never clobbered.
- **Toast** renders via a React portal to `document.body` with its own stacking context, so it's never hidden behind modals.

---

## Configuration

Key settings live in `src-tauri/tauri.conf.json`:
- `build.frontendDist` / `devUrl` — frontend build & dev targets.
- `bundle.resources` — packaged DLL resources (`resources/dlls/*`).
- `plugins.updater` — update server endpoint & public key.

---

## Releases & Updates

- The app checks version requirements on launch and can force/optionally prompt updates.
- Updates ship through the configured release channel (GitHub releases).

---

## Disclaimer

This project is provided as-is for educational and personal-use purposes. Users are responsible for using the software in accordance with the terms of service of any third-party platforms they interact with, and with local laws and regulations.

---

## License

Open source — see the repository for licensing details.

---

## Contributors

<a href="https://github.com/0xcRachel/Micah_0xC/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=0xcRachel/Micah_0xC" alt="Contributors" />
</a>

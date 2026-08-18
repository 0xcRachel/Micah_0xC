import { invoke } from '@tauri-apps/api/core';

// ==================== TYPES ====================

export interface AppIdEntry {
  appid: number;
  unlock_flag?: number;
  depot_key?: string;
}

export interface ManifestEntry {
  depot_id: number;
  manifest_gid: string;
}

export interface GameConfig {
  appid: number;
  name: string;
  enabled: boolean;
  depot_key?: string;
  access_token?: string;
  manifest_gid?: string;
  app_ticket_hex?: string;
  e_ticket_hex?: string;
  stat_steam_id?: string;
  appid_entries: AppIdEntry[];
  manifest_entries: ManifestEntry[];
}

export interface ManagerSettings {
  log_level: string;
  manifest_url: string;
  timeout_resolve_ms: number;
  timeout_connect_ms: number;
  timeout_send_ms: number;
  timeout_recv_ms: number;
  lua_paths: string[];
  pattern_mirror: string;
}

export type DllState = 'Missing' | 'Managed' | 'Foreign';
export type DllLoadState = 'Loaded' | 'NotLoaded' | 'SteamNotRunning' | 'VerifyFailed';

export interface DllStatus {
  name: string;
  state: DllState;
  target_path: string;
  resource_hash?: string;
  target_hash?: string;
  hash_matched: boolean;
  loaded_by_steam: boolean;
  load_state: DllLoadState;
}

export interface ScanState {
  steam_dir: string;
  steam_valid: boolean;
  steam_running: boolean;
  steam_version?: string;
  config_exists: boolean;
  lua_count: number;
  dlls: DllStatus[];
  dll_resources_ready: boolean;
  missing_dll_resources: string[];
  log_files: string[];
}

export interface AppMetadata {
  appid: number;
  name: string;
  source: string;
}

export interface LogFile {
  name: string;
  content: string;
  size_bytes: number;
  modified_time?: number;
  line_count: number;
}

export interface GitHubReleaseAsset {
  name: string;
  browser_download_url: string;
}

export interface ResolvedHost {
  host: string;
  addresses: string[];
}

export interface GitHubReleaseInfo {
  version: string;
  name: string;
  published_at?: string;
  body: string;
  html_url: string;
  assets: GitHubReleaseAsset[];
  prerelease: boolean;
  dns_optimized: boolean;
  resolved_hosts: ResolvedHost[];
}

export interface UpdateCheckInfo {
  channel: string;
  available: boolean;
  version: string;
  current_version: string;
  date?: string;
  body?: string;
  release?: GitHubReleaseInfo;
}

export interface DnsLatencyResult {
  provider: string;
  address: string;
  latency_ms?: number;
  ok: boolean;
  error?: string;
}

export interface DnsLatencyReport {
  host: string;
  results: DnsLatencyResult[];
}

export interface VersionCheckInfo {
  current_version: string;
  minimum_version: string;
  latest_version: string;
  download_url: string;
  release_notes: string;
  status: 'force' | 'optional' | 'none';
}

// ==================== STEAM DIRECTORY ====================

/** Auto-detect Steam installation directory from registry/common paths */
export const detectSteamDir = (): Promise<string | null> =>
  invoke<string | null>('detect_steam_dir');

/** Open a folder-picker dialog and return the selected path */
export const selectSteamDir = (): Promise<string | null> =>
  invoke<string | null>('select_steam_dir');

// ==================== SCAN & STATUS ====================

/** Full scan of the Steam directory — DLL states, config, Lua files, logs */
export const scanState = (steamDir: string): Promise<ScanState> =>
  invoke<ScanState>('scan_state', { steamDir });

// ==================== DLL MANAGEMENT ====================

/** Copy bundled DLLs into the Steam directory and write the install manifest */
export const installDlls = (steamDir: string): Promise<void> =>
  invoke<void>('install_dlls', { steamDir });

/** Remove managed DLLs from the Steam directory (only if hash matches) */
export const removeDlls = (steamDir: string): Promise<void> =>
  invoke<void>('remove_dlls', { steamDir });

// ==================== SETTINGS ====================

/** Read micah_mode.toml from the Steam directory */
export const loadSettings = (steamDir: string): Promise<ManagerSettings> =>
  invoke<ManagerSettings>('load_settings', { steamDir });

/** Write settings back to micah_mode.toml */
export const saveSettings = (steamDir: string, settings: ManagerSettings): Promise<void> =>
  invoke<void>('save_settings', { steamDir, settings });

// ==================== GAME / LUA MANAGEMENT ====================

/** List all G-*.lua games in <steam_dir>/config/lua */
export const listGames = (steamDir: string): Promise<GameConfig[]> =>
  invoke<GameConfig[]>('list_games', { steamDir });

/** Open a file-picker for a .lua file and import it */
export const importLuaFile = (steamDir: string): Promise<GameConfig | null> =>
  invoke<GameConfig | null>('import_lua_file', { steamDir });

/** Open the Lua directory in Explorer */
export const openLuaDir = (steamDir: string): Promise<void> =>
  invoke<void>('open_lua_dir', { steamDir });

// ==================== LUA AUTO IMPORT ====================

export interface AutoImportResult {
  appid: number;
  name: string;
  saved_paths: string[];
  steam_import_path?: string;
  lua_scripts_dir: string;
  imported: boolean;
}

/**
 * Auto-save a Lua script into the app's fixed `lua_scripts` folder and import
 * it into Steam's Lua directory that Micah_Mode.dll watches. `luaContent` is
 * optional — when omitted the script is fetched from the internal Micah Lua
 * API. `steamDir` is optional too; it is auto-detected when not provided.
 */
export const autoSaveAndImportLua = (
  appid: number,
  gameName: string,
  opts?: { steamDir?: string; luaContent?: string },
): Promise<AutoImportResult> =>
  invoke<AutoImportResult>('auto_save_and_import_lua', {
    appid,
    gameName,
    steamDir: opts?.steamDir ?? null,
    luaContent: opts?.luaContent ?? null,
  });

/** Path of the app's fixed `lua_scripts` folder */
export const getLuaScriptsDir = (): Promise<string> =>
  invoke<string>('lua_scripts_dir');

/** Check whether a Lua script exists for an AppID on the internal Micah Lua API */
export const checkLuaManifest = (appid: number): Promise<boolean> =>
  invoke<boolean>('check_lua_manifest', { appid });

/** Create or update a game entry (writes the .lua file) */
export const upsertGame = (steamDir: string, game: GameConfig): Promise<void> =>
  invoke<void>('upsert_game', { steamDir, game });

/** Delete a game's .lua file */
export const deleteGame = (steamDir: string, appid: number): Promise<void> =>
  invoke<void>('delete_game', { steamDir, appid });

/** Rename the .lua file to enable/disable a game */
export const setGameEnabled = (steamDir: string, appid: number, enabled: boolean): Promise<void> =>
  invoke<void>('set_game_enabled', { steamDir, appid, enabled });

// ==================== APP METADATA ====================

/** Fetch game name from Steam Store API by AppID */
export const fetchAppMetadata = (appid: number): Promise<AppMetadata> =>
  invoke<AppMetadata>('fetch_app_metadata', { appid });

/**
 * Resolve real game names for the given appids, using the local name cache
 * first and the Steam Store for the rest. Hydrates placeholder names
 * ("App {appid}") stored in cloud snapshots.
 */
export const resolveAppNames = (
  appids: number[],
): Promise<Record<string, string>> =>
  invoke<Record<string, string>>('resolve_app_names', { appids });

// ==================== LOGS ====================

/** Read all .log files from <steam_dir>/micah_mode/ */
export const readLogs = (steamDir: string): Promise<LogFile[]> =>
  invoke<LogFile[]>('read_logs', { steamDir });

// ==================== GITHUB / UPDATER ====================

/** Check latest GitHub release info */
export const checkGithubRelease = (dotEnabled: boolean): Promise<GitHubReleaseInfo> =>
  invoke<GitHubReleaseInfo>('check_github_release', { dotEnabled });

/** Resolve GitHub domain IPs (DOT DNS fallback) */
export const resolveGithubDomainWithDot = (host: string): Promise<string[]> =>
  invoke<string[]>('resolve_github_domain_with_dot', { host });

/** Test latency of multiple DNS providers for a host */
export const testGithubDnsLatency = (host: string): Promise<DnsLatencyReport> =>
  invoke<DnsLatencyReport>('test_github_dns_latency', { host });

/** Check if an update is available on the given channel */
export const checkUpdateChannel = (channel: string, dotEnabled: boolean): Promise<UpdateCheckInfo> =>
  invoke<UpdateCheckInfo>('check_update_channel', { channel, dotEnabled });

/** Download and install an update from the given channel */
export const installUpdateChannel = (channel: string, dotEnabled: boolean): Promise<void> =>
  invoke<void>('install_update_channel', { channel, dotEnabled });

// ==================== STEAM PROCESS ====================

/** Send shutdown signal to Steam */
export const closeSteam = (): Promise<void> =>
  invoke<void>('close_steam');

/** Close Steam then relaunch it from the given directory */
export const restartSteam = (steamDir: string): Promise<void> =>
  invoke<void>('restart_steam', { steamDir });

// ==================== WINDOW ====================

/** Minimize the current Tauri window */
export const minimizeWindow = (): Promise<void> =>
  invoke<void>('minimize_window');

/** Close the current Tauri window */
export const closeWindow = (): Promise<void> =>
  invoke<void>('close_window');

// ==================== VERSION CHECK ====================

/** Check if the current app version meets the minimum/minimum requirement from the server */
export const checkVersionRequirement = (): Promise<VersionCheckInfo> =>
  invoke<VersionCheckInfo>('check_version_requirement');

// ==================== BROWSER ====================

/** Open a URL in the user's default browser */
export const openInBrowser = (url: string): Promise<void> =>
  invoke<void>('open_in_browser', { url });

// ==================== OAUTH ====================

/**
 * Start a temporary localhost HTTP server that receives the OAuth callback
 * from the browser (instead of a custom deep link, which leaves the browser
 * tab hanging on Discord's "Redirecting…" screen). The callback payload
 * arrives on the `oauth://callback` event; this command resolves as soon as
 * the server is bound.
 */
export const startOauthCallbackListener = (
  port = 17375,
  timeoutSecs = 90,
): Promise<void> =>
  invoke<void>('start_oauth_callback_listener', { port, timeoutSecs });

// ==================== AUTOSTART / WINDOW ====================

/** Whether the app is set to launch at system startup */
export const isAutostartEnabled = (): Promise<boolean> =>
  invoke<boolean>('plugin:autostart|is_enabled');

/** Enable/disable launch at system startup */
export const setAutostartEnabled = (enabled: boolean): Promise<void> =>
  enabled
    ? invoke<void>('plugin:autostart|enable')
    : invoke<void>('plugin:autostart|disable');

/** Whether the window size/position should be remembered between sessions */
export const getWindowRemember = (): Promise<boolean> =>
  invoke<boolean>('get_window_remember');

/** Toggle window size/position persistence */
export const setWindowRemember = (remember: boolean): Promise<void> =>
  invoke<void>('set_window_remember', { remember });

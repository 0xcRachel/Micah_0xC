#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod auth;
mod manager;
mod oauth;
mod window_state;

use auth::{auth_clear_session, auth_load_session, auth_store_session};
use manager::{GameConfig, ManagerSettings};
use serde::Serialize;
use tauri::Emitter;
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_updater::UpdaterExt;

type CommandResult<T> = Result<T, String>;


#[derive(Debug, Clone, Serialize)]
struct SystemInfo {
    os: String,
    cpu: String,
    cores: String,
    ram: String,
    gpu: String,
}

#[tauri::command]
fn get_system_info() -> SystemInfo {
    use sysinfo::System;

    let mut sys = System::new_all();
    sys.refresh_all();

    // OS
    let os = format!(
        "{} {}",
        System::name().unwrap_or_else(|| "Windows".into()),
        System::os_version().unwrap_or_else(|| "".into())
    ).trim().to_string();

    // CPU
    let cpu_name = sys
        .cpus()
        .first()
        .map(|c| c.brand().trim().to_string())
        .unwrap_or_else(|| "Unknown CPU".into());

    let cores = sys.physical_core_count().unwrap_or(sys.cpus().len());
    let cores_str = format!("{} Cores", cores);

    // RAM (bytes -> GB rounded)
    let total_ram_gb = (sys.total_memory() as f64 / 1_073_741_824.0).round() as u64;
    let ram_str = format!("{} GB", total_ram_gb);

    // GPU — Windows: read from registry (Display Adapters)
    #[cfg(windows)]
    let gpu = {
        use winreg::{enums::HKEY_LOCAL_MACHINE, RegKey};
        let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
        let path = r"SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}\0000";
        hklm.open_subkey(path)
            .ok()
            .and_then(|k| k.get_value::<String, _>("DriverDesc").ok())
            .unwrap_or_else(|| "Unknown GPU".into())
    };
    #[cfg(not(windows))]
    let gpu = {
        // Non-Windows fallback: try sysinfo components
        sys.components()
            .iter()
            .find(|c| c.label().to_lowercase().contains("gpu"))
            .map(|c| c.label().to_string())
            .unwrap_or_else(|| "Unknown GPU".into())
    };

    SystemInfo {
        os,
        cpu: cpu_name,
        cores: cores_str,
        ram: ram_str,
        gpu,
    }
}

#[derive(Debug, Clone, Serialize)]
struct UpdateCheckInfo {
    channel: String,
    available: bool,
    version: String,
    current_version: String,
    date: Option<String>,
    body: Option<String>,
    release: Option<manager::GitHubReleaseInfo>,
}

#[tauri::command]
fn detect_steam_dir() -> CommandResult<Option<String>> {
    manager::detect_steam_dir().map(|path| path.map(manager::display_path))
}

#[tauri::command]
async fn select_steam_dir(app: tauri::AppHandle) -> CommandResult<Option<String>> {
    Ok(app
        .dialog()
        .file()
        .blocking_pick_folder()
        .and_then(|path| path.into_path().ok())
        .map(manager::display_path))
}
#[tauri::command]
async fn select_source_dir(app: tauri::AppHandle) -> CommandResult<Option<String>> {
    Ok(app
        .dialog()
        .file()
        .blocking_pick_folder()
        .and_then(|path| path.into_path().ok())
        .map(manager::display_path))
}

#[cfg(desktop)]
#[tauri::command]
fn trigger_steam_install(app: tauri::AppHandle, appid: u32) -> CommandResult<()> {
    // Opens Steam's own install flow (handles owned/free/family licenses at
    // full speed). Unowned games will 401 - see the Health tab, not a bug here.
    use tauri_plugin_shell::ShellExt;
    app.shell()
        .open(format!("steam://install/{appid}"), None)
        .map_err(|err| err.to_string())
}

#[cfg(not(desktop))]
#[tauri::command]
fn trigger_steam_install(_appid: u32) -> CommandResult<()> {
    Ok(())
}
#[tauri::command]
async fn detect_game_sdk(steam_dir: String, appid: u32) -> CommandResult<manager::SdkReport> {
    tauri::async_runtime::spawn_blocking(move || manager::detect_game_sdk(steam_dir, appid))
        .await
        .map_err(|err| err.to_string())?
}
#[tauri::command]
async fn scan_install_health(steam_dir: String) -> CommandResult<Vec<manager::GameHealth>> {
    // Walking multi-GB trees blocks - keep it off the async runtime.
    tauri::async_runtime::spawn_blocking(move || manager::scan_install_health(steam_dir))
        .await
        .map_err(|err| err.to_string())?
}

#[tauri::command]
async fn clean_ghost(steam_dir: String, appid: u32, force: bool) -> CommandResult<String> {
    tauri::async_runtime::spawn_blocking(move || manager::clean_ghost(steam_dir, appid, force))
        .await
        .map_err(|err| err.to_string())?
}
#[tauri::command]
async fn inject_local_game(
    steam_dir: String,
    appid: u32,
    source_dir: String,
) -> CommandResult<String> {
    tauri::async_runtime::spawn_blocking(move || manager::inject_local_game(steam_dir, appid, source_dir))
        .await
        .map_err(|err| err.to_string())?
}
#[tauri::command]
async fn scan_state(app: tauri::AppHandle, steam_dir: String) -> CommandResult<manager::ScanState> {
    // Resolve assets on the async side, then move the heavy scan (hashing
    // DLLs, module snapshot, file I/O) off the main thread.
    let assets =
        manager::resolve_dll_resource_dir_from_candidates(manager::dll_resource_candidates(&app));
    tauri::async_runtime::spawn_blocking(move || {
        manager::scan_state_with_assets(steam_dir, assets.as_deref())
    })
    .await
    .map_err(|err| err.to_string())?
}

#[tauri::command]
fn install_dlls(app: tauri::AppHandle, steam_dir: String) -> CommandResult<()> {
    let assets = manager::resource_dll_dir(&app)?;
    manager::install_dlls_from_dir(steam_dir, assets)
}

#[tauri::command]
fn remove_dlls(steam_dir: String) -> CommandResult<()> {
    manager::remove_dlls_from_dir(steam_dir)
}

#[tauri::command]
fn load_settings(steam_dir: String) -> CommandResult<ManagerSettings> {
    manager::load_settings_from_dir(steam_dir)
}

#[tauri::command]
fn save_settings(steam_dir: String, settings: ManagerSettings) -> CommandResult<()> {
    manager::save_settings_to_dir(steam_dir, &settings)
}

#[tauri::command]
async fn list_games(app: tauri::AppHandle, steam_dir: String) -> CommandResult<Vec<GameConfig>> {
    manager::list_games_from_dir_async(&app, steam_dir).await
}

#[tauri::command]
async fn import_lua_file(
    app: tauri::AppHandle,
    steam_dir: String,
) -> CommandResult<Option<GameConfig>> {
    let Some(path) = app
        .dialog()
        .file()
        .add_filter("Lua", &["lua"])
        .blocking_pick_file()
        .and_then(|path| path.into_path().ok())
    else {
        return Ok(None);
    };
    manager::import_lua_file_from_path(steam_dir, path).map(Some)
}

#[tauri::command]
fn open_lua_dir(steam_dir: String) -> CommandResult<()> {
    manager::open_lua_dir_for_steam(steam_dir)
}

#[tauri::command]
async fn auto_save_and_import_lua(
    app: tauri::AppHandle,
    steam_dir: Option<String>,
    appid: u32,
    game_name: String,
    lua_content: Option<String>,
) -> CommandResult<manager::AutoImportResult> {
    manager::auto_save_and_import_lua(
        &app,
        steam_dir.as_deref(),
        appid,
        &game_name,
        lua_content.as_deref(),
    )
    .await
}

#[tauri::command]
fn lua_scripts_dir(app: tauri::AppHandle) -> CommandResult<String> {
    manager::lua_scripts_dir(&app).map(manager::display_path)
}

/// Fetch the Lua script for a game from the internal Micah Lua API.
/// Returns (file_name, content) pairs.
#[tauri::command]
async fn fetch_manifest_lua(appid: u32) -> CommandResult<Vec<(String, String)>> {
    manager::fetch_manifest_lua_files(appid).await
}

/// Refresh pinned manifest gids for a game from steamcmd.net's live PICS
/// mirror and rewrite the changed Lua files (AppData copy + Steam copy).
/// Stale gids are what make Steam answer manifest downloads with 401.
#[tauri::command]
async fn refresh_manifest_gids(
    app: tauri::AppHandle,
    steam_dir: Option<String>,
    appid: u32,
) -> CommandResult<manager::ManifestRefreshResult> {
    manager::refresh_manifest_gids(&app, steam_dir.as_deref(), appid).await
}

/// Save pasted manifest request codes (`depot: code` lines) for the DLL to
/// prefer over every provider. Codes die in ~5 minutes, so paste fresh ones
/// and download immediately. Returns the merged pair count.
#[tauri::command]
fn save_manifest_code_overrides(
    steam_dir: Option<String>,
    text: String,
) -> CommandResult<usize> {
    manager::save_manifest_code_overrides(steam_dir.as_deref(), &text)
}

/// Current overrides file content (pretty JSON, `"{}"` when absent).
#[tauri::command]
fn read_manifest_code_overrides(
    steam_dir: Option<String>,
) -> CommandResult<String> {
    manager::read_manifest_code_overrides(steam_dir.as_deref())
}

/// Delete the overrides file (stops using pasted codes).
#[tauri::command]
fn clear_manifest_code_overrides(
    steam_dir: Option<String>,
) -> CommandResult<()> {
    manager::clear_manifest_code_overrides(steam_dir.as_deref())
}

/// Check whether a Lua script exists for an AppID on the internal Micah Lua
/// API (no payload download).
#[tauri::command]
async fn check_lua_manifest(appid: u32) -> CommandResult<bool> {
    manager::check_lua_manifest(appid).await
}

/// Download mirror manifests for every live depot missing from depotcache
/// and pin seeded GIDs into G-<appid>.lua (with .bak backup).
/// Works for ANY appid; missing pieces are reported, never faked.
/// node_base_url (e.g. the TestBELUA web) lets the Node layer resolve mirror
/// URLs; without it, ManifestHub3 raw URLs are HEAD-checked directly.
#[tauri::command]
async fn seed_manifests(
    steam_dir: Option<String>,
    appid: u32,
    node_base_url: Option<String>,
) -> CommandResult<manager::SeedManifestsResult> {
    manager::seed_manifests(steam_dir.as_deref(), appid, node_base_url.as_deref()).await
}

/// Headless install readiness for ANY appid: ensures Lua, seeds manifests,
/// then reports per-step outcome. ready_to_install is true only with zero
/// blockers. Writes Lua pins + depotcache files, touches no UI.
#[tauri::command]
async fn prepare_install(
    steam_dir: Option<String>,
    appid: u32,
    node_base_url: Option<String>,
) -> CommandResult<manager::PrepareInstallReport> {
    manager::prepare_install(steam_dir.as_deref(), appid, node_base_url.as_deref()).await
}

/// Read-only per-depot install state for ANY appid (no downloads, no writes).
#[tauri::command]
async fn install_status(
    steam_dir: Option<String>,
    appid: u32,
) -> CommandResult<manager::InstallStatus> {
    manager::install_status(steam_dir.as_deref(), appid).await
}

/// Validate a Lua/VDF text blob against the DepotBox public validation API.
#[tauri::command]
async fn validate_depotbox_lua(
    text: String,
    turnstile_token: Option<String>,
) -> CommandResult<manager::DepotboxValidateReport> {
    manager::validate_depotbox_lua(&text, turnstile_token.as_deref()).await
}

/// Search Steam Store games by name. Returns up to 8 results.
#[tauri::command]
async fn search_steam_games(query: String) -> CommandResult<Vec<manager::SearchResult>> {
    manager::search_steam_games(&query).await
}

/// Fetch full game details from Steam Store (name, image, reviews, price, etc.)
#[tauri::command]
async fn get_steam_game_detail(appid: u32) -> CommandResult<manager::GameDetail> {
    manager::get_steam_game_detail(appid).await
}

/// Download a Lua file from the OpenLua API (captcha-protected) and import it
/// into Steam's config/lua + the app's lua_scripts folder, mirroring the
/// existing `auto_save_and_import_lua` flow.
#[tauri::command]
async fn download_from_openlua(
    app: tauri::AppHandle,
    steam_dir: Option<String>,
    file_id: String,
    captcha_token: String,
    game_name: String,
) -> CommandResult<manager::AutoImportResult> {
    let lua_content = manager::fetch_openlua_lua_file(&app, &file_id, &captcha_token).await?;

    let appid = file_id
        .trim()
        .parse::<u32>()
        .map_err(|_| "File ID must be a numeric Steam AppID".to_string())?;

    manager::auto_save_and_import_lua(
        &app,
        steam_dir.as_deref(),
        appid,
        &game_name,
        Some(&lua_content),
    )
    .await
}

/// Probe the OpenLua API with a captcha token without importing anything.
/// Used by test mode to verify the token works and the payload is real Lua.
#[tauri::command]
async fn test_openlua_token(
    app: tauri::AppHandle,
    file_id: String,
    captcha_token: String,
) -> CommandResult<manager::OpenLuaTestResult> {
    manager::test_openlua_token(&app, &file_id, &captcha_token).await
}

#[tauri::command]
fn upsert_game(steam_dir: String, game: GameConfig) -> CommandResult<()> {
    manager::upsert_game_in_dir(steam_dir, &game)
}

#[tauri::command]
fn delete_game(steam_dir: String, appid: u32) -> CommandResult<()> {
    manager::delete_game_from_dir(steam_dir, appid)
}

#[tauri::command]
fn set_game_enabled(steam_dir: String, appid: u32, enabled: bool) -> CommandResult<()> {
    manager::set_game_enabled_in_dir(steam_dir, appid, enabled)
}

#[tauri::command]
async fn fetch_app_metadata(appid: u32) -> CommandResult<manager::AppMetadata> {
    manager::fetch_app_metadata(appid).await
}

#[tauri::command]
async fn resolve_app_names(
    app: tauri::AppHandle,
    appids: Vec<u32>,
) -> CommandResult<std::collections::BTreeMap<u32, String>> {
    manager::resolve_app_names(&app, &appids).await
}

#[tauri::command]
async fn read_logs(steam_dir: String) -> CommandResult<Vec<manager::LogFile>> {
    tauri::async_runtime::spawn_blocking(move || manager::read_logs_from_dir(steam_dir))
        .await
        .map_err(|err| err.to_string())?
}

#[tauri::command]
async fn check_github_release(dot_enabled: bool) -> CommandResult<manager::GitHubReleaseInfo> {
    manager::check_github_release(dot_enabled).await
}

#[tauri::command]
async fn resolve_github_domain_with_dot(host: String) -> CommandResult<Vec<String>> {
    manager::resolve_github_domain_with_dot(&host).await
}

#[tauri::command]
async fn test_github_dns_latency(host: String) -> CommandResult<manager::DnsLatencyReport> {
    manager::test_github_dns_latency(&host).await
}

#[tauri::command]
async fn check_update_channel(
    app: tauri::AppHandle,
    channel: String,
    dot_enabled: bool,
) -> CommandResult<UpdateCheckInfo> {
    let (endpoint, release) = update_endpoint_for_channel(&channel, dot_enabled).await?;
    let mut builder = app
        .updater_builder()
        .endpoints(vec![
            reqwest::Url::parse(&endpoint).map_err(|err| err.to_string())?
        ])
        .map_err(|err| err.to_string())?;

    if channel == "beta" {
        builder = builder.version_comparator(|current, update| update.version != current);
    }

    let update = builder
        .build()
        .map_err(|err| err.to_string())?
        .check()
        .await
        .map_err(|err| describe_update_error(&err.to_string()))?;

    Ok(if let Some(update) = update {
        UpdateCheckInfo {
            channel,
            available: true,
            version: update.version,
            current_version: update.current_version,
            date: update.date.map(|date| date.to_string()),
            body: update.body,
            release,
        }
    } else {
        let version = release
            .as_ref()
            .map(|release| release.version.clone())
            .unwrap_or_else(|| "0.2.0-beta.1".to_string());
        UpdateCheckInfo {
            channel,
            available: false,
            version,
            current_version: app.package_info().version.to_string(),
            date: release
                .as_ref()
                .and_then(|release| release.published_at.clone()),
            body: release.as_ref().map(|release| release.body.clone()),
            release,
        }
    })
}

#[tauri::command]
async fn install_update_channel(
    app: tauri::AppHandle,
    channel: String,
    dot_enabled: bool,
) -> CommandResult<()> {
    let (endpoint, _) = update_endpoint_for_channel(&channel, dot_enabled).await?;
    let mut builder = app
        .updater_builder()
        .endpoints(vec![
            reqwest::Url::parse(&endpoint).map_err(|err| err.to_string())?
        ])
        .map_err(|err| err.to_string())?;

    if channel == "beta" {
        builder = builder.version_comparator(|current, update| update.version != current);
    }

    let Some(update) = builder
        .build()
        .map_err(|err| err.to_string())?
        .check()
        .await
        .map_err(|err| describe_update_error(&err.to_string()))?
    else {
        return Err("No update available for this channel".into());
    };

    // Emit progress events so the frontend can show a progress bar.
    // On Windows, download_and_install() calls std::process::exit(0) after
    // launching the NSIS installer — these events fire during the download phase.
    let app_clone = app.clone();
    update
        .download_and_install(
            move |chunk_length, content_length| {
                let _ = app_clone.emit(
                    "update-progress",
                    serde_json::json!({
                        "chunk": chunk_length,
                        "total": content_length,
                    }),
                );
            },
            move || {
                let _ = app.emit("update-finished", ());
            },
        )
        .await
        .map_err(|err| err.to_string())
}

async fn update_endpoint_for_channel(
    channel: &str,
    dot_enabled: bool,
) -> CommandResult<(String, Option<manager::GitHubReleaseInfo>)> {
    match channel {
        "stable" => Ok((manager::STABLE_UPDATE_ENDPOINT.to_string(), None)),
        "beta" => {
            let release = manager::check_github_beta_release(dot_enabled).await?;
            let endpoint = manager::release_asset_url(&release, manager::BETA_UPDATE_METADATA)
                .ok_or_else(|| "beta-latest.json not found in GitHub Pre-release".to_string())?;
            Ok((endpoint, Some(release)))
        }
        other => Err(format!("Unsupported update channel: {other}")),
    }
}

fn describe_update_error(error: &str) -> String {
    if error.contains("Could not fetch a valid release JSON")
        || error.contains("latest.json")
        || error.contains("404")
    {
        "latest.json not found. Please upload Tauri updater metadata to GitHub Release for stable updates."
            .into()
    } else if error.contains("beta-latest.json") {
        "beta-latest.json not found. Please upload beta updater metadata to GitHub Pre-release."
            .into()
    } else {
        error.to_string()
    }
}

#[tauri::command]
async fn close_steam() -> CommandResult<()> {
    manager::close_steam()
}

#[tauri::command]
async fn restart_steam(steam_dir: String) -> CommandResult<()> {
    manager::restart_steam(steam_dir)
}

#[tauri::command]
fn minimize_window(window: tauri::Window) -> CommandResult<()> {
    window.minimize().map_err(|err| err.to_string())
}

#[tauri::command]
fn close_window(window: tauri::Window) -> CommandResult<()> {
    window.close().map_err(|err| err.to_string())
}

#[tauri::command]
async fn download_manifest_direct(app: tauri::AppHandle, appid: u32) -> CommandResult<String> {
    use std::fs::File;
    use std::io::Write;
    use tauri_plugin_dialog::DialogExt;

    // 1. Show save folder dialog
    let save_folder = app
        .dialog()
        .file()
        .blocking_pick_folder();

    let Some(folder_path) = save_folder.and_then(|p| p.into_path().ok()) else {
        return Err("Download cancelled by user".into());
    };

    // 2. Get list of files from GitHub API
    let api_url = format!(
        "https://api.github.com/repos/SSMGAlt/ManifestHub2/contents/?ref={}",
        appid
    );

    let client = reqwest::Client::new();
    let response = client
        .get(&api_url)
        .header("User-Agent", "Micah0xC-App")
        .send()
        .await
        .map_err(|err| format!("Failed to connect to GitHub API: {}", err))?;

    if !response.status().is_success() {
        return Err(format!(
            "GitHub API returned error status: {}",
            response.status()
        ));
    }

    let files: Vec<serde_json::Value> = response
        .json()
        .await
        .map_err(|err| format!("Failed to parse GitHub API response: {}", err))?;

    // 3. Filter only .lua files and download them
    let mut downloaded_count = 0;

    for file_obj in files {
        let file_name = file_obj
            .get("name")
            .and_then(|v| v.as_str())
            .ok_or_else(|| "Invalid file entry from API".to_string())?;

        // Only download .lua files
        if !file_name.ends_with(".lua") {
            continue;
        }

        let download_url = file_obj
            .get("download_url")
            .and_then(|v| v.as_str())
            .ok_or_else(|| "No download URL in API response".to_string())?;

        // Download the .lua file
        let file_response = client
            .get(download_url)
            .header("User-Agent", "Micah0xC-App")
            .send()
            .await
            .map_err(|err| format!("Failed to download {}: {}", file_name, err))?;

        if !file_response.status().is_success() {
            return Err(format!("Failed to download {}: {}", file_name, file_response.status()));
        }

        let file_bytes = file_response
            .bytes()
            .await
            .map_err(|err| format!("Failed to read file data: {}", err))?;

        // Write to disk
        let output_path = folder_path.join(file_name);
        let mut output_file = File::create(&output_path)
            .map_err(|err| format!("Failed to create file {}: {}", file_name, err))?;

        output_file
            .write_all(&file_bytes)
            .map_err(|err| format!("Failed to write file {}: {}", file_name, err))?;

        downloaded_count += 1;
    }

    if downloaded_count == 0 {
        return Err(
            "No .lua files found in the repository. Repository may be empty.".into(),
        );
    }

    Ok(format!(
        "Downloaded {} .lua file(s) to: {}",
        downloaded_count,
        folder_path.display()
    ))
}

#[tauri::command]
fn start_oauth_callback_listener(
    app: tauri::AppHandle,
    port: u16,
    timeout_secs: u64,
) -> CommandResult<()> {
    oauth::start_oauth_callback_listener(app, port, timeout_secs)
}

#[cfg(desktop)]
#[tauri::command]
#[allow(deprecated)]
fn open_in_browser(app: tauri::AppHandle, url: String) -> CommandResult<()> {
    use tauri_plugin_shell::ShellExt;
    app.shell().open(url, None).map_err(|err| err.to_string())
}

#[cfg(not(desktop))]
#[tauri::command]
fn open_in_browser(url: String) -> CommandResult<()> {
    // No-op or fallback on non-desktop platforms
    Ok(())
}


// ==================== VERSION CHECK ====================

/// Update status returned to the frontend.
/// - "force":    current < minimum  → user MUST update (app locked)
/// - "optional": minimum ≤ current < latest → update available but app still usable
/// - "none":     current ≥ latest  → already on the latest version
#[derive(Debug, Clone, Serialize)]
struct VersionCheckInfo {
    current_version: String,
    minimum_version: String,
    latest_version: String,
    download_url: String,
    release_notes: String,
    status: String, // "force" | "optional" | "none"
}

#[tauri::command]
async fn check_version_requirement() -> CommandResult<VersionCheckInfo> {
    let current_version = env!("CARGO_PKG_VERSION").to_string();

    // Fetch version config from GitHub.
    // Append a cache-busting timestamp so GitHub Raw (5-min CDN cache) always
    // returns the latest version-config.json instead of a stale copy.
    let url = format!(
        "https://raw.githubusercontent.com/0xcRachel/Micah_0xC/main/version-config.json?t={}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs()
    );
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|err| format!("Failed to build HTTP client: {}", err))?;
    let response = client
        .get(&url)
        .header("User-Agent", "Micah0xC-App")
        .header("Cache-Control", "no-cache, no-store, must-revalidate")
        .header("Pragma", "no-cache")
        .send()
        .await
        .map_err(|err| format!("Failed to fetch version config: {}", err))?;

    if !response.status().is_success() {
        return Err(format!(
            "Failed to fetch version config: {}",
            response.status()
        ));
    }

    let config: serde_json::Value = response
        .json()
        .await
        .map_err(|err| format!("Failed to parse version config: {}", err))?;

    let minimum_version = config
        .get("minimum_version")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Version config missing minimum_version field".to_string())?
        .to_string();

    let latest_version = config
        .get("latest_version")
        .and_then(|v| v.as_str())
        .unwrap_or(&minimum_version)
        .to_string();

    let download_url = config
        .get("download_url")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    let release_notes = config
        .get("release_notes")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    // Determine update status
    let cmp_min = compare_versions(&current_version, &minimum_version);
    let cmp_lat = compare_versions(&current_version, &latest_version);

    let status = if cmp_min < 0 {
        "force"
    } else if cmp_lat < 0 {
        "optional"
    } else {
        "none"
    };

    Ok(VersionCheckInfo {
        current_version,
        minimum_version,
        latest_version,
        download_url,
        release_notes,
        status: status.to_string(),
    })
}

fn compare_versions(current: &str, minimum: &str) -> i32 {
    let current_parts: Vec<u32> = current
        .split('.')
        .filter_map(|s| s.parse().ok())
        .collect();
    let minimum_parts: Vec<u32> = minimum
        .split('.')
        .filter_map(|s| s.parse().ok())
        .collect();

    for i in 0..3 {
        let curr = current_parts.get(i).copied().unwrap_or(0);
        let min = minimum_parts.get(i).copied().unwrap_or(0);
        if curr < min {
            return -1;
        }
        if curr > min {
            return 1;
        }
    }
    0
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // Windows/Linux spawn a new instance when a deep link is opened.
            // With the `deep-link` feature enabled, this plugin automatically
            // forwards the CLI args to the deep-link plugin before this
            // callback runs, so the `deep-link://new-url` event fires in this
            // (already-running) instance and the frontend completes the OAuth
            // exchange. Bring the existing window to the front.
            use tauri::Manager;
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_deep_link::init())
        .on_window_event(|window, event| {
            // Remember the window bounds before it closes.
            window_state::on_window_event(window, event);
        })
        .setup(|app| {
            // Create the fixed lua_scripts folder on startup if missing.
            if let Err(err) = manager::ensure_lua_scripts_dir(app.handle()) {
                eprintln!("[setup] lua_scripts dir: {err}");
            }
            // Restore the window size/position from the previous session.
            window_state::restore(app.handle());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_system_info,
            detect_steam_dir,
            select_steam_dir,
            scan_state,
            scan_install_health,
            clean_ghost,
            inject_local_game,
            select_source_dir,
            trigger_steam_install,
            detect_game_sdk,
            install_dlls,
            remove_dlls,
            load_settings,
            save_settings,
            list_games,
            import_lua_file,
            open_lua_dir,
            auto_save_and_import_lua,
            fetch_manifest_lua,
            refresh_manifest_gids,
            seed_manifests,
            prepare_install,
            install_status,
            save_manifest_code_overrides,
            read_manifest_code_overrides,
            clear_manifest_code_overrides,
            check_lua_manifest,
            validate_depotbox_lua,
            search_steam_games,
            get_steam_game_detail,
            download_from_openlua,
            test_openlua_token,
            lua_scripts_dir,
            upsert_game,
            delete_game,
            set_game_enabled,
            fetch_app_metadata,
            resolve_app_names,
            read_logs,
            check_github_release,
            resolve_github_domain_with_dot,
            test_github_dns_latency,
            check_update_channel,
            install_update_channel,
            close_steam,
            restart_steam,
            minimize_window,
            close_window,
            open_in_browser,
            start_oauth_callback_listener,
            download_manifest_direct,
            check_version_requirement,
            auth_store_session,
            auth_load_session,
            auth_clear_session,
            window_state::get_window_remember,
            window_state::set_window_remember
        ])
        .run(tauri::generate_context!())
        .expect("error while running Micah0xC");
}
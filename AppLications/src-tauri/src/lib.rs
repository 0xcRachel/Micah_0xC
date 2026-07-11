#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod manager;

use manager::{GameConfig, ManagerSettings};
use serde::Serialize;
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_updater::UpdaterExt;

type CommandResult<T> = Result<T, String>;

// ==================== SYSTEM INFO ====================

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
fn scan_state(app: tauri::AppHandle, steam_dir: String) -> CommandResult<manager::ScanState> {
    let assets =
        manager::resolve_dll_resource_dir_from_candidates(manager::dll_resource_candidates(&app));
    manager::scan_state_with_assets(steam_dir, assets.as_deref())
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
async fn list_games(steam_dir: String) -> CommandResult<Vec<GameConfig>> {
    manager::list_games_from_dir_async(steam_dir).await
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
fn read_logs(steam_dir: String) -> CommandResult<Vec<manager::LogFile>> {
    manager::read_logs_from_dir(steam_dir)
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

    update
        .download_and_install(|_, _| {}, || {})
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
fn close_steam() -> CommandResult<()> {
    manager::close_steam()
}

#[tauri::command]
fn restart_steam(steam_dir: String) -> CommandResult<()> {
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
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            get_system_info,
            detect_steam_dir,
            select_steam_dir,
            scan_state,
            install_dlls,
            remove_dlls,
            load_settings,
            save_settings,
            list_games,
            import_lua_file,
            open_lua_dir,
            upsert_game,
            delete_game,
            set_game_enabled,
            fetch_app_metadata,
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
            download_manifest_direct,
            check_version_requirement
        ])
        .run(tauri::generate_context!())
        .expect("error while running Micah0xC");
}
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
#[cfg(windows)]
use std::os::windows::process::CommandExt;
use std::{
    collections::BTreeMap,
    ffi::OsStr,
    fs,
    io::{Read, Seek, SeekFrom},
    path::{Path, PathBuf},
    process::Command,
    thread,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
use tauri::path::BaseDirectory;
use tauri::Manager;
#[cfg(windows)]
use windows::Win32::{
    Foundation::CloseHandle,
    System::Diagnostics::ToolHelp::{
        CreateToolhelp32Snapshot, Module32FirstW, Module32NextW, Process32FirstW, Process32NextW,
        MODULEENTRY32W, PROCESSENTRY32W, TH32CS_SNAPMODULE, TH32CS_SNAPMODULE32,
        TH32CS_SNAPPROCESS,
    },
};
#[cfg(windows)]
use winreg::{enums::*, RegKey};

// ==================== CONSTANTS ====================
const DLL_NAMES: [&str; 3] = ["Micah_Mode.dll", "dwmapi.dll", "xinput1_4.dll"];
const INSTALL_MANIFEST: &str = ".micah-mode-dlls.json";
const META_PREFIX: &str = "-- GOST-META: ";
const LUA_SCRIPTS_DIR: &str = "lua_scripts";
const NAME_CACHE_FILE: &str = "name_cache.json";
const NAME_CACHE_TTL_SECS: u64 = 30 * 24 * 3600;
const STORE_FETCH_TIMEOUT: Duration = Duration::from_secs(8);
const MAX_LOG_TAIL: u64 = 80_000;
const OPENLUA_API_BASE: &str = "https://api.openlua.cloud";
const OPENLUA_DOWNLOAD_PATH: &str = "/download/";
const OPENLUA_FINGERPRINT_PATH: &str = "/fingerprint";
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

pub type Result<T> = std::result::Result<T, String>;

// ==================== DATA STRUCTURES ====================

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ManagerSettings {
    pub log_level: String,
    pub manifest_url: String,
    pub timeout_resolve_ms: u64,
    pub timeout_connect_ms: u64,
    pub timeout_send_ms: u64,
    pub timeout_recv_ms: u64,
    pub lua_paths: Vec<String>,
    pub pattern_mirror: String,
}

impl Default for ManagerSettings {
    fn default() -> Self {
        Self {
            log_level: "info".into(),
            manifest_url: "wudrm".into(),
            timeout_resolve_ms: 5000,
            timeout_connect_ms: 5000,
            timeout_send_ms: 10000,
            timeout_recv_ms: 10000,
            lua_paths: Vec::new(),
            pattern_mirror: String::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct AppIdEntry {
    pub appid: u32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub unlock_flag: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub depot_key: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ManifestEntry {
    pub depot_id: u32,
    pub manifest_gid: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct GameConfig {
    pub appid: u32,
    pub name: String,
    #[serde(default = "default_true")]
    pub enabled: bool,
    pub depot_key: Option<String>,
    pub access_token: Option<String>,
    pub manifest_gid: Option<String>,
    pub app_ticket_hex: Option<String>,
    pub e_ticket_hex: Option<String>,
    pub stat_steam_id: Option<String>,
    #[serde(default)]
    pub appid_entries: Vec<AppIdEntry>,
    #[serde(default)]
    pub manifest_entries: Vec<ManifestEntry>,
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum DllState {
    Missing,
    Managed,
    Foreign,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum DllLoadState {
    Loaded,
    NotLoaded,
    SteamNotRunning,
    VerifyFailed,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct DllStatus {
    pub name: String,
    pub state: DllState,
    pub target_path: String,
    pub resource_hash: Option<String>,
    pub target_hash: Option<String>,
    pub hash_matched: bool,
    pub loaded_by_steam: bool,
    pub load_state: DllLoadState,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ScanState {
    pub steam_dir: String,
    pub steam_valid: bool,
    pub steam_running: bool,
    pub steam_version: Option<String>,
    pub config_exists: bool,
    pub lua_count: usize,
    pub dlls: Vec<DllStatus>,
    pub dll_resources_ready: bool,
    pub missing_dll_resources: Vec<String>,
    pub log_files: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct AppMetadata {
    pub appid: u32,
    pub name: String,
    pub source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub appid: u32,
    pub name: String,
    pub header_image: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameDetail {
    pub appid: u32,
    pub name: String,
    pub header_image: String,
    pub developers: Vec<String>,
    pub publishers: Vec<String>,
    pub genres: Vec<String>,
    pub categories: Vec<String>,
    pub metacritic: u32,
    pub score: u32,
    pub score_label: String,
    pub price: String,
    pub short_description: String,
    pub release_date: String,
    pub pc_requirements_minimum: String,
    pub pc_requirements_recommended: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct NameCacheEntry {
    pub name: String,
    pub fetched_at: u64,
}

pub type NameCacheMap = BTreeMap<u32, NameCacheEntry>;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct LogFile {
    pub name: String,
    pub content: String,
    pub size_bytes: u64,
    pub modified_time: Option<u64>,
    pub line_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct AutoImportResult {
    pub appid: u32,
    pub name: String,
    pub saved_paths: Vec<String>,
    pub steam_import_path: Option<String>,
    pub lua_scripts_dir: String,
    pub imported: bool,
    /// Manifest binaries seeded into depotcache during this import (step 3c).
    /// Without these, Steam 401s the download for unowned games.
    #[serde(default)]
    pub manifests_seeded: u32,
    /// Live depots whose manifest no mirror carries yet.
    #[serde(default)]
    pub manifests_missing: Vec<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct GitHubReleaseInfo {
    pub version: String,
    pub name: String,
    pub published_at: Option<String>,
    pub body: String,
    pub html_url: String,
    pub assets: Vec<GitHubReleaseAsset>,
    pub prerelease: bool,
    pub dns_optimized: bool,
    pub resolved_hosts: Vec<ResolvedHost>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct GitHubReleaseAsset {
    pub name: String,
    pub browser_download_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ResolvedHost {
    pub host: String,
    pub addresses: Vec<String>,
}

pub const STABLE_UPDATE_ENDPOINT: &str =
    "https://github.com/0xcRachel/Micah_0xC/releases/latest/download/latest.json";
pub const BETA_UPDATE_METADATA: &str = "beta-latest.json";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct DnsLatencyReport {
    pub host: String,
    pub results: Vec<DnsLatencyResult>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct DnsLatencyResult {
    pub provider: String,
    pub address: String,
    pub latency_ms: Option<u64>,
    pub ok: bool,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct DnsProviderSpec {
    pub provider: &'static str,
    pub address: &'static str,
    pub server_name: &'static str,
    pub path: &'static str,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CommandSpec {
    pub program: String,
    pub args: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct InstallManifest {
    dlls: BTreeMap<String, String>,
}

struct SteamModuleScan {
    steam_running: bool,
    verify_failed: bool,
    modules: Vec<(String, PathBuf)>,
}

// ==================== STEAM DIRECTORY VALIDATION ====================

pub fn validate_steam_dir<P: AsRef<Path>>(steam_dir: P) -> Result<PathBuf> {
    let path = steam_dir.as_ref();
    if !path.is_dir() {
        return Err("Steam directory does not exist".into());
    }
    let steam_exe = path.join("steam.exe");
    if !steam_exe.is_file() {
        return Err("Selected directory must contain steam.exe".into());
    }
    fs::canonicalize(path).map_err(|err| err.to_string())
}

pub fn detect_steam_dir() -> Result<Option<PathBuf>> {
    detect_steam_dir_from_candidates(steam_dir_candidates())
}

pub fn detect_steam_dir_from_candidates<I>(candidates: I) -> Result<Option<PathBuf>>
where
    I: IntoIterator<Item = PathBuf>,
{
    for candidate in candidates {
        if let Ok(path) = validate_steam_dir(&candidate) {
            return Ok(Some(path));
        }
    }
    Ok(None)
}

pub fn display_path<P: AsRef<Path>>(path: P) -> String {
    strip_verbatim_prefix(&path.as_ref().display().to_string())
}

pub fn strip_verbatim_prefix(path: &str) -> String {
    if let Some(rest) = path.strip_prefix(r"\\?\UNC\") {
        format!(r"\\{rest}")
    } else if let Some(rest) = path.strip_prefix(r"\\?\") {
        rest.to_string()
    } else {
        path.to_string()
    }
}

pub fn steam_dir_candidates() -> Vec<PathBuf> {
    let mut candidates = steam_registry_candidates();
    if let Ok(path) = std::env::var("ProgramFiles(x86)") {
        candidates.push(PathBuf::from(path).join("Steam"));
    }
    if let Ok(path) = std::env::var("ProgramFiles") {
        candidates.push(PathBuf::from(path).join("Steam"));
    }
    candidates.push(PathBuf::from("C:\\Program Files (x86)\\Steam"));

    dedupe_paths(candidates)
}

#[cfg(windows)]
fn steam_registry_candidates() -> Vec<PathBuf> {
    let mut candidates = Vec::new();

    if let Ok(key) = RegKey::predef(HKEY_CURRENT_USER).open_subkey("Software\\Valve\\Steam") {
        if let Ok(path) = key.get_value::<String, _>("SteamPath") {
            candidates.push(PathBuf::from(normalize_steam_registry_path(path)));
        }
        if let Ok(exe) = key.get_value::<String, _>("SteamExe") {
            let exe = PathBuf::from(normalize_steam_registry_path(exe));
            if let Some(parent) = exe.parent() {
                candidates.push(parent.to_path_buf());
            }
        }
    }

    for root in [
        "SOFTWARE\\WOW6432Node\\Valve\\Steam",
        "SOFTWARE\\Valve\\Steam",
    ] {
        if let Ok(key) = RegKey::predef(HKEY_LOCAL_MACHINE).open_subkey(root) {
            if let Ok(path) = key.get_value::<String, _>("InstallPath") {
                candidates.push(PathBuf::from(normalize_steam_registry_path(path)));
            }
        }
    }

    candidates
}

#[cfg(not(windows))]
fn steam_registry_candidates() -> Vec<PathBuf> {
    Vec::new()
}

fn normalize_steam_registry_path(path: String) -> String {
    path.replace('/', "\\")
}

fn dedupe_paths(paths: Vec<PathBuf>) -> Vec<PathBuf> {
    let mut result = Vec::new();
    for path in paths {
        if !result.iter().any(|existing: &PathBuf| existing == &path) {
            result.push(path);
        }
    }
    result
}

// ==================== DLL RESOURCE MANAGEMENT ====================

pub fn resource_dll_dir(app: &tauri::AppHandle) -> Result<PathBuf> {
    resolve_dll_resource_dir_from_candidates(dll_resource_candidates(app))
        .ok_or_else(|| "Missing bundled DLL resources".to_string())
}

pub fn dll_resource_candidates(app: &tauri::AppHandle) -> Vec<PathBuf> {
    let mut candidates = Vec::new();
    if let Ok(path) = app.path().resolve("dlls", BaseDirectory::Resource) {
        candidates.push(path);
    }
    if let Ok(dir) = app.path().resource_dir() {
        candidates.push(dir.join("dlls"));
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            candidates.push(dir.join("dlls"));
            candidates.push(dir.join("resources").join("dlls"));
        }
    }
    if let Ok(cwd) = std::env::current_dir() {
        candidates.push(cwd.join("src-tauri").join("resources").join("dlls"));
        candidates.push(cwd.join("resources").join("dlls"));
        candidates.push(cwd.join("dlls"));
        if cwd.file_name().and_then(OsStr::to_str) == Some("src-tauri") {
            if let Some(parent) = cwd.parent() {
                candidates.push(parent.join("src-tauri").join("resources").join("dlls"));
                candidates.push(parent.join("dlls"));
            }
        }
    }
    dedupe_paths(candidates)
}

pub fn resolve_dll_resource_dir_from_candidates<I>(candidates: I) -> Option<PathBuf>
where
    I: IntoIterator<Item = PathBuf>,
{
    candidates
        .into_iter()
        .find(|candidate| missing_resources(Some(candidate)).is_empty())
}

fn missing_resources(assets_dir: Option<&Path>) -> Vec<String> {
    DLL_NAMES
        .iter()
        .filter(|name| {
            assets_dir
                .map(|dir| !dir.join(name).is_file())
                .unwrap_or(true)
        })
        .map(|name| (*name).to_string())
        .collect()
}

// ==================== DLL INSTALL / REMOVE ====================

pub fn install_dlls_from_dir<P: AsRef<Path>, Q: AsRef<Path>>(
    steam_dir: P,
    assets_dir: Q,
) -> Result<()> {
    let steam_dir = validate_steam_dir(steam_dir)?;
    let assets_dir = assets_dir.as_ref();
    let missing = missing_resources(Some(assets_dir));
    if !missing.is_empty() {
        return Err(format!(
            "Missing bundled DLL resources: {}",
            missing.join(", ")
        ));
    }

    let mut manifest = InstallManifest {
        dlls: BTreeMap::new(),
    };
    for name in DLL_NAMES {
        let src = assets_dir.join(name);
        let dst = steam_dir.join(name);
        fs::copy(&src, &dst).map_err(|err| format!("Failed to copy {}: {}", name, err))?;
        manifest.dlls.insert(name.to_string(), file_hash(&dst)?);
    }
    write_manifest(&steam_dir, &manifest)
}

pub fn remove_dlls_from_dir<P: AsRef<Path>>(steam_dir: P) -> Result<()> {
    let steam_dir = validate_steam_dir(steam_dir)?;
    let manifest = read_manifest(&steam_dir)?;
    for (name, expected_hash) in manifest.dlls {
        let path = steam_dir.join(&name);
        if path.exists() && file_hash(&path).ok() == Some(expected_hash) {
            fs::remove_file(path).map_err(|err| err.to_string())?;
        }
    }
    let manifest_path = steam_dir.join(INSTALL_MANIFEST);
    if manifest_path.exists() {
        fs::remove_file(manifest_path).map_err(|err| err.to_string())?;
    }
    Ok(())
}

fn write_manifest(steam_dir: &Path, manifest: &InstallManifest) -> Result<()> {
    let text = serde_json::to_string_pretty(manifest).map_err(|err| err.to_string())?;
    fs::write(steam_dir.join(INSTALL_MANIFEST), text).map_err(|err| err.to_string())
}

fn read_manifest(steam_dir: &Path) -> Result<InstallManifest> {
    let path = steam_dir.join(INSTALL_MANIFEST);
    if !path.exists() {
        return Ok(InstallManifest {
            dlls: BTreeMap::new(),
        });
    }
    let text = fs::read_to_string(path).map_err(|err| err.to_string())?;
    serde_json::from_str(&text).map_err(|err| err.to_string())
}

fn file_hash(path: &Path) -> Result<String> {
    let mut file = fs::File::open(path).map_err(|err| err.to_string())?;
    let mut hasher = Sha256::new();
    let mut buffer = [0_u8; 8192];
    loop {
        let read = file.read(&mut buffer).map_err(|err| err.to_string())?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}

// ==================== STEAM SCAN & STATUS ====================

pub fn scan_state_with_assets<P: AsRef<Path>, Q: AsRef<Path>>(
    steam_dir: P,
    assets_dir: Option<Q>,
) -> Result<ScanState> {
    let steam_dir = validate_steam_dir(&steam_dir)?;
    let asset_path = assets_dir.as_ref().map(|path| path.as_ref().to_path_buf());
    let missing_dll_resources = missing_resources(asset_path.as_deref());
    let module_scan = scan_steam_modules();
    // Scan the DLLs in parallel — each does its own file I/O + hashing.
    let steam_dir_ref = &steam_dir;
    let asset_path_ref = asset_path.as_deref();
    let module_scan_ref = &module_scan;
    let dlls = std::thread::scope(|scope| {
        DLL_NAMES
            .iter()
            .map(|name| {
                scope.spawn(move || {
                    dll_status(steam_dir_ref, asset_path_ref, name, module_scan_ref)
                })
            })
            .collect::<Vec<_>>()
            .into_iter()
            .map(|handle| {
                handle.join().unwrap_or_else(|_| {
                    Err("DLL scan thread panicked".to_string())
                })
            })
            .collect::<Result<Vec<_>>>()
    })?;
    let log_files = list_log_names(&steam_dir);
    Ok(ScanState {
        steam_dir: display_path(&steam_dir),
        steam_valid: true,
        steam_running: module_scan.steam_running,
        steam_version: steam_version(&steam_dir),
        config_exists: steam_dir.join("micah_mode.toml").exists(),
        lua_count: count_lua_files(&steam_dir),
        dlls,
        dll_resources_ready: missing_dll_resources.is_empty(),
        missing_dll_resources,
        log_files,
    })
}

fn dll_status(
    steam_dir: &Path,
    assets_dir: Option<&Path>,
    name: &str,
    module_scan: &SteamModuleScan,
) -> Result<DllStatus> {
    let target = steam_dir.join(name);
    let resource = assets_dir.map(|dir| dir.join(name)).filter(|p| p.exists());
    let target_exists = target.exists();

    // Fast path: hashes can only match when both files exist with the same
    // size — otherwise skip hashing the 12MB DLLs entirely (the common case
    // right after a Steam update or a missing install).
    let sizes_equal = match (&resource, target_exists) {
        (Some(r), true) => {
            let r_len = fs::metadata(r).map(|m| m.len()).unwrap_or(0);
            let t_len = fs::metadata(&target).map(|m| m.len()).unwrap_or(0);
            r_len == t_len
        }
        _ => false,
    };

    let (resource_hash, target_hash, hash_matched) = if sizes_equal {
        let r_hash = file_hash(resource.as_ref().expect("resource exists"))?;
        let t_hash = file_hash(&target)?;
        let matched = r_hash == t_hash;
        (Some(r_hash), Some(t_hash), matched)
    } else {
        (None, None, false)
    };

    let state = if !target_exists {
        DllState::Missing
    } else if resource.is_some() {
        if hash_matched {
            DllState::Managed
        } else {
            DllState::Foreign
        }
    } else {
        DllState::Foreign
    };
    let load_state = dll_load_state_from_modules(
        steam_dir,
        name,
        module_scan.steam_running,
        module_scan.verify_failed,
        &module_scan.modules,
    );
    Ok(DllStatus {
        name: name.to_string(),
        state,
        target_path: display_path(target),
        resource_hash,
        target_hash,
        hash_matched,
        loaded_by_steam: load_state == DllLoadState::Loaded,
        load_state,
    })
}

fn dll_load_state_from_modules(
    steam_dir: &Path,
    dll_name: &str,
    steam_running: bool,
    verify_failed: bool,
    modules: &[(String, PathBuf)],
) -> DllLoadState {
    if !steam_running {
        return DllLoadState::SteamNotRunning;
    }
    if verify_failed {
        return DllLoadState::VerifyFailed;
    }
    let loaded = modules.iter().any(|(module_name, module_path)| {
        module_name.eq_ignore_ascii_case(dll_name) && path_is_inside_dir(module_path, steam_dir)
    });
    if loaded {
        DllLoadState::Loaded
    } else {
        DllLoadState::NotLoaded
    }
}

fn path_is_inside_dir(path: &Path, dir: &Path) -> bool {
    let base = comparable_path(dir);
    let candidate = comparable_path(path);
    candidate == base || candidate.starts_with(&format!("{base}\\"))
}

fn comparable_path(path: &Path) -> String {
    display_path(path)
        .replace('/', "\\")
        .trim_end_matches('\\')
        .to_ascii_lowercase()
}

fn scan_steam_modules() -> SteamModuleScan {
    #[cfg(windows)]
    {
        scan_steam_modules_windows()
    }
    #[cfg(not(windows))]
    {
        SteamModuleScan {
            steam_running: false,
            verify_failed: false,
            modules: Vec::new(),
        }
    }
}

#[cfg(windows)]
fn scan_steam_modules_windows() -> SteamModuleScan {
    let mut scan = SteamModuleScan {
        steam_running: false,
        verify_failed: false,
        modules: Vec::new(),
    };

    let process_snapshot = match unsafe { CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) } {
        Ok(handle) => handle,
        Err(_) => {
            scan.steam_running = is_steam_running();
            scan.verify_failed = scan.steam_running;
            return scan;
        }
    };

    let mut process = PROCESSENTRY32W {
        dwSize: std::mem::size_of::<PROCESSENTRY32W>() as u32,
        ..Default::default()
    };

    let mut has_process = unsafe { Process32FirstW(process_snapshot, &mut process).is_ok() };
    while has_process {
        let exe_name = wide_to_string(&process.szExeFile);
        if exe_name.eq_ignore_ascii_case("steam.exe") {
            scan.steam_running = true;
            match process_modules(process.th32ProcessID) {
                Ok(modules) => scan.modules.extend(modules),
                Err(_) => scan.verify_failed = true,
            }
        }
        has_process = unsafe { Process32NextW(process_snapshot, &mut process).is_ok() };
    }

    let _ = unsafe { CloseHandle(process_snapshot) };
    scan
}

#[cfg(windows)]
fn process_modules(process_id: u32) -> Result<Vec<(String, PathBuf)>> {
    let snapshot =
        unsafe { CreateToolhelp32Snapshot(TH32CS_SNAPMODULE | TH32CS_SNAPMODULE32, process_id) }
            .map_err(|err| err.to_string())?;

    let mut modules = Vec::new();
    let mut module = MODULEENTRY32W {
        dwSize: std::mem::size_of::<MODULEENTRY32W>() as u32,
        ..Default::default()
    };

    let mut has_module = unsafe { Module32FirstW(snapshot, &mut module).is_ok() };
    while has_module {
        modules.push((
            wide_to_string(&module.szModule),
            PathBuf::from(wide_to_string(&module.szExePath)),
        ));
        has_module = unsafe { Module32NextW(snapshot, &mut module).is_ok() };
    }

    let _ = unsafe { CloseHandle(snapshot) };
    Ok(modules)
}

#[cfg(windows)]
fn wide_to_string(value: &[u16]) -> String {
    let len = value
        .iter()
        .position(|character| *character == 0)
        .unwrap_or(value.len());
    String::from_utf16_lossy(&value[..len])
}

fn is_steam_running() -> bool {
    #[cfg(windows)]
    {
        hidden_command("powershell")
            .args([
                "-NoProfile",
                "-Command",
                "if (Get-Process -Name steam -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }",
            ])
            .status()
            .map(|status| status.success())
            .unwrap_or(false)
    }
    #[cfg(not(windows))]
    {
        use sysinfo::{System, SystemExt};
        let sys = System::new_all();
        sys.processes()
            .values()
            .any(|p| p.name().eq_ignore_ascii_case("steam.exe"))
    }
}

/// Whether an orphaned Steam webhelper process is still around after a
/// force-kill (it can block the next Steam launch).
fn is_steam_webhelper_running() -> bool {
    #[cfg(windows)]
    {
        hidden_command("powershell")
            .args([
                "-NoProfile",
                "-Command",
                "if (Get-Process -Name steamwebhelper -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }",
            ])
            .status()
            .map(|status| status.success())
            .unwrap_or(false)
    }
    #[cfg(not(windows))]
    {
        use sysinfo::{System, SystemExt};
        let sys = System::new_all();
        sys.processes()
            .values()
            .any(|p| p.name().eq_ignore_ascii_case("steamwebhelper.exe"))
    }
}

fn steam_version(steam_dir: &Path) -> Option<String> {
    steam_manifest_version(steam_dir)
        .or_else(|| steam_exe_file_version(&steam_dir.join("steam.exe")))
        .or_else(|| {
            let path = steam_dir.join("steam.cfg");
            fs::read_to_string(path).ok().and_then(|text| {
                text.lines()
                    .find(|line| line.to_ascii_lowercase().contains("version"))
                    .map(|line| line.trim().to_string())
            })
        })
}

fn steam_manifest_version(steam_dir: &Path) -> Option<String> {
    [
        steam_dir
            .join("package")
            .join("steam_client_win64.manifest"),
        steam_dir
            .join("package")
            .join("steam_client_win32.manifest"),
    ]
    .into_iter()
    .find_map(|path| {
        fs::read_to_string(path)
            .ok()
            .and_then(|text| parse_steam_manifest_version(&text))
    })
}

pub fn parse_steam_manifest_version(text: &str) -> Option<String> {
    text.lines().find_map(|line| {
        let trimmed = line.trim();
        if !trimmed.starts_with("\"version\"") {
            return None;
        }
        trimmed
            .split('"')
            .nth(3)
            .map(str::trim)
            .filter(|version| !version.is_empty() && version.chars().all(|c| c.is_ascii_digit()))
            .map(ToString::to_string)
    })
}

fn steam_exe_file_version(path: &Path) -> Option<String> {
    let literal_path = escape_powershell_single_quoted(&display_path(path));
    let script = format!(
        "(Get-Item -LiteralPath '{}').VersionInfo.FileVersion",
        literal_path
    );
    hidden_command("powershell")
        .args(["-NoProfile", "-Command", &script])
        .output()
        .ok()
        .filter(|output| output.status.success())
        .and_then(|output| String::from_utf8(output.stdout).ok())
        .and_then(|version| parse_steam_file_version_output(&version))
}

pub fn parse_steam_file_version_output(output: &str) -> Option<String> {
    output
        .lines()
        .map(str::trim)
        .find(|line| !line.is_empty())
        .map(ToString::to_string)
}

fn escape_powershell_single_quoted(value: &str) -> String {
    value.replace('\'', "''")
}

// ==================== STEAM PROCESS MANAGEMENT ====================

/// How long to wait for a graceful `-shutdown` before force-killing.
/// Steam saves state, closes webhelper, etc. — 4s was far too short and
/// caused force-kills that made the next launch hang ("Not Responding").
const GRACEFUL_SHUTDOWN_TIMEOUT: Duration = Duration::from_secs(20);
/// How long to wait after a force-kill before giving up.
const FORCE_SHUTDOWN_TIMEOUT: Duration = Duration::from_secs(6);
/// Grace period after steam.exe is gone so the OS releases process locks
/// and any leftover children before a new instance is spawned.
const RELAUNCH_SETTLE_DELAY: Duration = Duration::from_millis(1200);

pub fn close_steam() -> Result<()> {
    shutdown_steam(None)?;
    Ok(())
}

pub fn restart_steam<P: AsRef<Path>>(steam_dir: P) -> Result<()> {
    let steam_dir = validate_steam_dir(steam_dir)?;
    shutdown_steam(Some(&steam_dir))?;
    // Don't relaunch instantly: a fresh steam.exe started while the old
    // instance's locks/children are still being torn down will stall on
    // startup and appear unresponsive.
    thread::sleep(RELAUNCH_SETTLE_DELAY);
    hidden_command(steam_dir.join("steam.exe"))
        .current_dir(steam_dir)
        .spawn()
        .map_err(|err| err.to_string())?;
    Ok(())
}

fn shutdown_steam(steam_dir: Option<&Path>) -> Result<()> {
    if !is_steam_running() {
        return Ok(());
    }

    // 1. Graceful shutdown — give Steam plenty of time to exit on its own.
    if let Some(graceful) = steam_shutdown_command_specs(steam_dir).first() {
        let _ = run_command_spec(graceful);
    }
    wait_for_steam_exit(GRACEFUL_SHUTDOWN_TIMEOUT);

    // 2. Last resort: force-kill the whole process tree.
    if is_steam_running() {
        let _ = run_command_spec(&force_steam_shutdown_command());
        wait_for_steam_exit(FORCE_SHUTDOWN_TIMEOUT);
    }

    // 3. A force-killed Steam can leave orphaned webhelper processes that
    //    interfere with the next launch — clear them as well.
    if is_steam_running() || is_steam_webhelper_running() {
        let _ = run_command_spec(&CommandSpec {
            program: "taskkill".into(),
            args: vec!["/IM".into(), "steamwebhelper.exe".into(), "/T".into(), "/F".into()],
        });
        thread::sleep(Duration::from_millis(800));
    }

    if is_steam_running() {
        return Err("Steam is still running after shutdown request".into());
    }
    Ok(())
}

fn wait_for_steam_exit(timeout: Duration) {
    let started = std::time::Instant::now();
    while started.elapsed() < timeout {
        if !is_steam_running() {
            break;
        }
        thread::sleep(Duration::from_millis(250));
    }
}

pub fn steam_shutdown_command_specs(steam_dir: Option<&Path>) -> Vec<CommandSpec> {
    let mut commands = Vec::new();
    if let Some(steam_dir) = steam_dir {
        commands.push(CommandSpec {
            program: display_path(steam_dir.join("steam.exe")),
            args: vec!["-shutdown".into()],
        });
    } else {
        commands.push(CommandSpec {
            program: "cmd".into(),
            args: vec![
                "/C".into(),
                "start".into(),
                "".into(),
                "steam://exit".into(),
            ],
        });
    }
    commands.push(force_steam_shutdown_command());
    commands
}

fn force_steam_shutdown_command() -> CommandSpec {
    CommandSpec {
        program: "taskkill".into(),
        args: vec!["/IM".into(), "steam.exe".into(), "/T".into(), "/F".into()],
    }
}

fn run_command_spec(spec: &CommandSpec) -> Result<()> {
    let status = hidden_command(&spec.program)
        .args(&spec.args)
        .status()
        .map_err(|err| err.to_string())?;
    if status.success() {
        Ok(())
    } else {
        Err(format!(
            "Command failed: {} {}",
            spec.program,
            spec.args.join(" ")
        ))
    }
}

fn hidden_command<S: AsRef<OsStr>>(program: S) -> Command {
    let mut command = Command::new(program);
    #[cfg(windows)]
    command.creation_flags(CREATE_NO_WINDOW);
    command
}

fn open_dir(path: &Path) -> Result<()> {
    #[cfg(windows)]
    {
        hidden_command("explorer")
            .arg(display_path(path))
            .spawn()
            .map_err(|err| err.to_string())?;
        Ok(())
    }
    #[cfg(not(windows))]
    {
        hidden_command("xdg-open")
            .arg(path)
            .spawn()
            .map_err(|err| err.to_string())?;
        Ok(())
    }
}

// ==================== LUA MANAGEMENT ====================

fn lua_dir(steam_dir: &Path) -> PathBuf {
    steam_dir.join("config").join("lua")
}

/// Fixed directory inside app_data_dir where downloaded Lua scripts are kept.
/// Created on demand; callers use `ensure_lua_scripts_dir` at startup.
pub fn lua_scripts_dir(app: &tauri::AppHandle) -> Result<PathBuf> {
    let base = app
        .path()
        .app_data_dir()
        .map_err(|err| format!("Failed to resolve app data dir: {err}"))?;
    let dir = base.join(LUA_SCRIPTS_DIR);
    fs::create_dir_all(&dir).map_err(|err| format!("Failed to create {}: {err}", dir.display()))?;
    Ok(dir)
}

/// Ensure the fixed `lua_scripts` directory exists. Call once at app startup.
pub fn ensure_lua_scripts_dir(app: &tauri::AppHandle) -> Result<PathBuf> {
    lua_scripts_dir(app)
}

// ── game name cache ──────────────────────────────────────────────────
// Stores Steam Store app names next to `lua_scripts` in app_data so the
// Games tab renders instantly on every visit instead of re-querying the
// network. Entries expire after NAME_CACHE_TTL_SECS.

fn name_cache_path(app: &tauri::AppHandle) -> Result<PathBuf> {
    let base = app
        .path()
        .app_data_dir()
        .map_err(|err| format!("Failed to resolve app data dir: {err}"))?;
    Ok(base.join(NAME_CACHE_FILE))
}

fn load_name_cache(path: &Path) -> NameCacheMap {
    fs::read_to_string(path)
        .ok()
        .and_then(|text| serde_json::from_str(&text).ok())
        .unwrap_or_default()
}

fn save_name_cache(path: &Path, cache: &NameCacheMap) {
    if let Ok(text) = serde_json::to_string_pretty(cache) {
        let _ = fs::write(path, text);
    }
}

fn fresh_cached_name(cache: &NameCacheMap, appid: u32, now: u64) -> Option<String> {
    cache
        .get(&appid)
        .filter(|entry| now.saturating_sub(entry.fetched_at) < NAME_CACHE_TTL_SECS)
        .map(|entry| entry.name.clone())
}

fn game_file_name(appid: u32, enabled: bool) -> String {
    if enabled {
        format!("G-{appid}.lua")
    } else {
        format!("G-{appid}.lua.disabled")
    }
}

fn is_enabled_lua_name(name: &str) -> bool {
    name.starts_with("G-") && name.ends_with(".lua")
}

fn is_disabled_lua_name(name: &str) -> bool {
    name.starts_with("G-") && name.ends_with(".lua.disabled")
}

fn is_managed_lua_name(name: &str) -> bool {
    is_enabled_lua_name(name) || is_disabled_lua_name(name)
}

/// Count managed Lua files without reading their content (fast directory scan).
fn count_lua_files(steam_dir: &Path) -> usize {
    let dir = lua_dir(steam_dir);
    fs::read_dir(&dir)
        .map_err(|err| err.to_string())
        .map(|entries| {
            entries
                .filter_map(|e| e.ok())
                .filter(|e| {
                    e.path()
                        .file_name()
                        .and_then(OsStr::to_str)
                        .map(is_managed_lua_name)
                        .unwrap_or(false)
                })
                .count()
        })
        .unwrap_or(0)
}

pub async fn list_games_from_dir_async<P: AsRef<Path>>(
    app: &tauri::AppHandle,
    steam_dir: P,
) -> Result<Vec<GameConfig>> {
    let steam_dir = validate_steam_dir(steam_dir)?;
    let lua_dir = lua_dir(&steam_dir);
    if !lua_dir.is_dir() {
        return Ok(Vec::new());
    }

    // Phase 1: Collect file paths (fast directory listing)
    let mut file_entries: Vec<(PathBuf, String, bool)> = Vec::new();
    for entry in fs::read_dir(&lua_dir).map_err(|err| err.to_string())? {
        let entry = entry.map_err(|err| err.to_string())?;
        let path = entry.path();
        let Some(name) = path.file_name().and_then(OsStr::to_str).map(str::to_string) else {
            continue;
        };
        if !is_managed_lua_name(&name) {
            continue;
        }
        let enabled = is_enabled_lua_name(&name);
        file_entries.push((path, name, enabled));
    }

    // Phase 2: Read + parse all files in parallel on the blocking pool
    let handles: Vec<_> = file_entries
        .into_iter()
        .map(|(path, name, enabled)| {
            tokio::task::spawn_blocking(move || {
                let text = fs::read_to_string(&path).ok()?;
                let mut game = parse_game_lua(&name, &text)?;
                game.enabled = enabled;
                Some(game)
            })
        })
        .collect();

    let mut games: Vec<GameConfig> = Vec::new();
    for handle in handles {
        if let Ok(Some(game)) = handle.await {
            games.push(game);
        }
    }
    games.sort_by_key(|game| game.appid);

    // Hydrate placeholder names ("App {appid}") from the local name cache,
    // then batch-fetch any still-missing names from the Steam Store in a
    // single request (3s timeout) and persist them to the cache.
    let cache_path = name_cache_path(app)?;
    let now = system_time_secs(SystemTime::now()).unwrap_or(0);
    let mut cache = load_name_cache(&cache_path);
    let mut pending: Vec<u32> = Vec::new();
    for game in games.iter_mut() {
        if !game.name.starts_with("App ") || game.appid == 0 {
            continue;
        }
        match fresh_cached_name(&cache, game.appid, now) {
            Some(cached) => game.name = cached,
            None => {
                // Try stale cache as fallback (offline / API down)
                if let Some(entry) = cache.get(&game.appid) {
                    game.name = entry.name.clone();
                } else {
                    pending.push(game.appid);
                }
            }
        }
    }
    if !pending.is_empty() {
        if let Ok(names) = fetch_store_names(&pending).await {
            let mut updated = false;
            for game in games.iter_mut() {
                if let Some(name) = names.get(&game.appid) {
                    game.name = name.clone();
                    cache.insert(
                        game.appid,
                        NameCacheEntry {
                            name: name.clone(),
                            fetched_at: now,
                        },
                    );
                    updated = true;
                }
            }
            if updated {
                save_name_cache(&cache_path, &cache);
            }
        }
    }
    Ok(games)
}

pub fn upsert_game_in_dir<P: AsRef<Path>>(steam_dir: P, game: &GameConfig) -> Result<()> {
    let steam_dir = validate_steam_dir(steam_dir)?;
    let lua_dir = lua_dir(&steam_dir);
    fs::create_dir_all(&lua_dir).map_err(|err| err.to_string())?;
    fs::write(
        lua_dir.join(game_file_name(game.appid, game.enabled)),
        render_game_lua(game)?,
    )
    .map_err(|err| err.to_string())
}

pub fn delete_game_from_dir<P: AsRef<Path>>(steam_dir: P, appid: u32) -> Result<()> {
    let steam_dir = validate_steam_dir(steam_dir)?;
    let lua_dir = lua_dir(&steam_dir);
    for enabled in [true, false] {
        let path = lua_dir.join(game_file_name(appid, enabled));
        if path.exists() {
            fs::remove_file(path).map_err(|err| err.to_string())?;
            return Ok(());
        }
    }
    Ok(())
}

pub fn set_game_enabled_in_dir<P: AsRef<Path>>(
    steam_dir: P,
    appid: u32,
    enabled: bool,
) -> Result<()> {
    let steam_dir = validate_steam_dir(steam_dir)?;
    let lua_dir = lua_dir(&steam_dir);
    let source = lua_dir.join(game_file_name(appid, !enabled));
    let target = lua_dir.join(game_file_name(appid, enabled));
    if target.exists() {
        return Err(format!(
            "Target Lua file already exists: {}",
            target.display()
        ));
    }
    if !source.exists() {
        return Err(format!("Source Lua file not found: {}", source.display()));
    }
    fs::rename(source, target).map_err(|err| err.to_string())
}

pub fn import_lua_file_from_path<P: AsRef<Path>, Q: AsRef<Path>>(
    steam_dir: P,
    source_path: Q,
) -> Result<GameConfig> {
    let steam_dir = validate_steam_dir(steam_dir)?;
    let source_path = source_path.as_ref();
    let file_name = source_path
        .file_name()
        .and_then(OsStr::to_str)
        .ok_or_else(|| "Invalid Lua file name".to_string())?;
    let text = fs::read_to_string(source_path).map_err(|err| err.to_string())?;
    let mut game =
        parse_game_lua(file_name, &text).ok_or_else(|| "Unable to parse AppId from Lua file".to_string())?;
    game.enabled = true;
    upsert_game_in_dir(&steam_dir, &game)?;
    Ok(game)
}

/// Sanitize a game name into a filesystem-safe file name stem.
fn sanitize_file_stem(name: &str) -> String {
    let mut stem: String = name
        .trim()
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == ' ' {
                c
            } else {
                '_'
            }
        })
        .collect();
    while stem.contains("__") {
        stem = stem.replace("__", "_");
    }
    let stem = stem.trim_matches('_').trim().to_string();
    if stem.is_empty() {
        "game".to_string()
    } else {
        stem.replace(' ', "_")
    }
}

/// Ensure the app's `lua_scripts` folder is registered in micah_mode.toml
/// `[lua] paths` so Micah_Mode.dll watches it and hot-reloads any script.
/// Performs a surgical edit of the `paths` array to preserve every other
/// config section ([manifest], [log], [remote], [stats], [inject], [cloud]).
/// Returns true when the config file was (re)written.
fn register_lua_scripts_path(steam_dir: &Path, scripts_dir: &Path) -> Result<bool> {
    let script_path = display_path(scripts_dir);
    let config_path = steam_dir.join("micah_mode.toml");

    // Read existing content (defaults if the file does not exist yet).
    let text = match fs::read_to_string(&config_path) {
        Ok(text) => text,
        Err(_) => "[manifest]\nurl = \"wudrm\"\n\n[lua]\npaths = []\n".to_string(),
    };

    // Bail out if the path is already registered (compare the escaped entry).
    let entry = format!("\"{}\"", escape_toml(&script_path));
    if text.lines().any(|line| {
        let trimmed = line.trim();
        if !trimmed.starts_with("paths") || !trimmed.contains('[') {
            return false;
        }
        // Compare case-insensitively inside the inline array.
        let norm_line = trimmed.to_ascii_lowercase();
        let norm_entry = entry.to_ascii_lowercase();
        if norm_line.contains(&norm_entry) {
            return true;
        }
        // Fallback: split array elements and compare normalized paths.
        trimmed
            .split(',')
            .any(|part| {
                let candidate = part.trim().trim_matches('"').trim();
                !candidate.is_empty()
                    && comparable_path(Path::new(candidate)) == comparable_path(scripts_dir)
            })
    }) {
        // Already registered — still make sure the [manifest] provider
        // section exists (default = wudrm) so Micah_Mode.dll never falls
        // back to the dead opensteamtool provider on older/hand-made
        // configs.
        if !text.contains("[manifest]") {
            fs::write(&config_path, format!("[manifest]\nurl = \"wudrm\"\n\n{text}"))
                .map_err(|err| err.to_string())?;
            return Ok(true);
        }
        return Ok(false);
    }

    // Make sure the [manifest] section exists with the working provider
    // default, so Micah_Mode.dll never falls back to the dead
    // opensteamtool provider when the config was created by an older
    // version or by hand.
    let has_manifest = text.contains("[manifest]");
    let text = if has_manifest {
        text
    } else {
        format!("[manifest]\nurl = \"wudrm\"\n\n{text}")
    };

    // Locate the `[lua]` table and its `paths` array line.
    let lua_section_start = text
        .find("[lua]")
        .ok_or_else(|| "micah_mode.toml is missing a [lua] section".to_string())?;
    let section_end = text[lua_section_start..]
        .find("\n[")
        .map(|idx| lua_section_start + idx)
        .unwrap_or(text.len());
    let section = &text[lua_section_start..section_end];

    let paths_line_idx = section
        .lines()
        .enumerate()
        .find_map(|(idx, line)| {
            let trimmed = line.trim_start();
            if trimmed.starts_with("paths") && trimmed.contains('[') {
                Some(idx)
            } else {
                None
            }
        })
        .ok_or_else(|| "micah_mode.toml [lua] section is missing a paths array".to_string())?;

    let line_start = section
        .char_indices()
        .filter(|(idx, _)| {
            let prefix = &section[..*idx];
            prefix.matches('\n').count() == paths_line_idx
        })
        .map(|(idx, _)| idx)
        .next()
        .ok_or_else(|| "Failed to locate paths line".to_string())?;
    let line_end = section[line_start..]
        .find('\n')
        .map(|idx| line_start + idx)
        .unwrap_or(section.len());

    let old_line = &section[line_start..line_end];
    let new_line = if old_line.trim_end().ends_with(']') {
        // Insert before the closing bracket.
        let insert_at = old_line.rfind(']').unwrap_or(old_line.len());
        format!(
            "{}{}{}{}",
            &old_line[..insert_at],
            if old_line[..insert_at].trim_end().ends_with('[') { "" } else { ", " },
            entry,
            "]"
        )
    } else {
        return Err("paths line does not end with a closing bracket".into());
    };

    let new_text = format!(
        "{}{}{}",
        &text[..lua_section_start + line_start],
        new_line,
        &text[lua_section_start + line_end..]
    );

    if text != new_text {
        fs::write(&config_path, new_text).map_err(|err| err.to_string())?;
        Ok(true)
    } else {
        Ok(false)
    }
}

/// Auto-save Lua scripts into the app's `lua_scripts` folder and import them
/// into Steam's Lua directory that Micah_Mode.dll watches.
///
/// When `lua_content` is provided it is used verbatim. Otherwise the .lua
/// files are fetched from the ManifestHub2 GitHub repository (branch = appid).
/// When `steam_dir` is provided it is used verbatim; otherwise the directory
/// is auto-detected from the registry.
pub async fn auto_save_and_import_lua(
    app: &tauri::AppHandle,
    steam_dir: Option<&str>,
    appid: u32,
    game_name: &str,
    lua_content: Option<&str>,
) -> Result<AutoImportResult> {
    // 0. Prepare per-script payloads: name hint + raw content.
    let scripts: Vec<(String, String)> = match lua_content {
        Some(content) => {
            let content = content.trim();
            if content.is_empty() {
                return Err("Lua content is empty".into());
            }
            vec![(format!("{appid}_{}.lua", sanitize_file_stem(game_name)), content.to_string())]
        }
        None => {
            let files = fetch_manifest_lua_files(appid).await?;
            if files.is_empty() {
                return Err(format!("No .lua files found in the repository for AppID {appid}"));
            }
            files
        }
    };

    // 1. Persist each script into the fixed lua_scripts folder.
    let scripts_dir = lua_scripts_dir(app)?;
    let mut saved_paths = Vec::new();
    for (_name_hint, content) in &scripts {
        let file_name = if scripts.len() == 1 {
            format!("{appid}_{}.lua", sanitize_file_stem(game_name))
        } else {
            let stem = sanitize_file_stem(game_name);
            let idx = format!("{appid}_{}_{}.lua", stem, saved_paths.len() + 1);
            idx
        };
        let path = scripts_dir.join(file_name);
        fs::write(&path, content)
            .map_err(|err| format!("Failed to write {}: {}", path.display(), err))?;
        saved_paths.push(display_path(path));
    }

    // 2. Resolve the Steam directory (explicit selection wins over detection).
    let steam = match steam_dir {
        Some(dir) if !dir.trim().is_empty() => validate_steam_dir(dir)?,
        _ => detect_steam_dir()?.ok_or_else(|| {
            "Steam directory not found. Please select it in the app first.".to_string()
        })?,
    };

    // 3. Import the first script as the managed G-{appid}.lua into
    //    <steam>/config/lua — the exact directory Micah_Mode.dll's
    //    LuaFileWatcher watches. It hot-reloads the file instantly, so no
    //    Steam restart or manual import is needed.
    let (_, first_content) = &scripts[0];
    let mut game = parse_game_lua(&format!("G-{appid}.lua"), first_content).unwrap_or(GameConfig {
        appid,
        name: game_name.trim().to_string(),
        enabled: true,
        depot_key: None,
        access_token: None,
        manifest_gid: None,
        app_ticket_hex: None,
        e_ticket_hex: None,
        stat_steam_id: None,
        appid_entries: Vec::new(),
        manifest_entries: Vec::new(),
    });
    game.enabled = true;
    upsert_game_in_dir(&steam, &game)?;

    // 3b. Best-effort manifest refresh so fresh installs pin CURRENT public
    // gids instead of whatever the Lua repository shipped (stale gids 401 on
    // download). Never fails the import: provider hiccups must not block
    // adding games.
    {
        let steam_str = steam.to_string_lossy().into_owned();
        // Best-effort only: refresh already rewrote both Lua copies when it
        // found drift, and any error is silently ignored here.
        let _ = tokio::time::timeout(
            Duration::from_secs(25),
            refresh_manifest_gids(app, Some(steam_str.as_str()), game.appid),
        )
        .await;
    }

    // 3c. Best-effort manifest seed so the game can actually DOWNLOAD:
    // Lua alone only makes Steam show the game; without a cached manifest
    // the CDN answers 401 for unowned games. Never fails the import.
    let (manifests_seeded, manifests_missing) = {
        let steam_str = steam.to_string_lossy().into_owned();
        let seed_fut = seed_manifests(Some(steam_str.as_str()), game.appid, None);
        match tokio::time::timeout(Duration::from_secs(120), seed_fut).await {
            Ok(Ok(seed)) => {
                let mut missing = seed.missing.clone();
                missing.sort_unstable();
                (seed.seeded.len() as u32, missing)
            }
            Ok(Err(_)) | Err(_) => (0, Vec::new()),
        }
    };

    let steam_import_path = display_path(
        steam.join("config").join("lua").join(game_file_name(game.appid, true)),
    );

    // 4. Register lua_scripts in micah_mode.toml [lua] paths so the DLL also
    //    watches the app's own folder (ConfigFileWatcher restarts on change).
    register_lua_scripts_path(&steam, &scripts_dir)?;

    Ok(AutoImportResult {
        appid: game.appid,
        name: game.name,
        saved_paths,
        steam_import_path: Some(steam_import_path),
        lua_scripts_dir: display_path(scripts_dir),
        imported: true,
        manifests_seeded,
        manifests_missing,
    })
}

/// Base URL of the internal Micah Lua API (override via `MICAH_LUA_API_BASE`
/// in `.env` at the project root). Falls back to the production endpoint.
fn micah_lua_api_base() -> String {
    dotenvy::dotenv().ok();
    std::env::var("MICAH_LUA_API_BASE")
        .unwrap_or_else(|_| "https://micah-lua.vercel.app/api/micah/lua".to_string())
}

/// Check whether a Lua script exists for the given AppID on the internal
/// Micah API without downloading the full payload.
pub async fn check_lua_manifest(appid: u32) -> Result<bool> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(12))
        .user_agent("Micah0xC-App")
        .build()
        .map_err(|e| e.to_string())?;
    let url = format!("{}/{}", micah_lua_api_base(), appid);
    let response = client
        .get(&url)
        .header("User-Agent", "Micah0xC-App")
        .send()
        .await
        .map_err(|err| format!("Failed to connect to Micah Lua API: {err}"))?;

    match response.status().as_u16() {
        200 => Ok(true),
        404 => Ok(false),
        status => Err(format!("Micah Lua API returned error status: {status}")),
    }
}

/// Fetch the Lua script for the given AppID from the internal Micah Lua API.
/// Returns (name, content) pairs — a single entry whose content is the full
/// script (the API serves one pre-rendered Lua blob per AppID, so no
/// per-file listing is needed like the old ManifestHub2 repository).
pub async fn fetch_manifest_lua_files(appid: u32) -> Result<Vec<(String, String)>> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(12))
        .user_agent("Micah0xC-App")
        .build()
        .map_err(|e| e.to_string())?;
    let url = format!("{}/{}", micah_lua_api_base(), appid);
    let response = client
        .get(&url)
        .header("User-Agent", "Micah0xC-App")
        .send()
        .await
        .map_err(|err| format!("Failed to connect to Micah Lua API: {err}"))?;

    match response.status().as_u16() {
        200 => {}
        404 => return Err(format!("No Lua script found for AppID {appid}")),
        status => {
            return Err(format!("Micah Lua API returned error status: {status}"))
        }
    }

    let content = response
        .text()
        .await
        .map_err(|err| format!("Failed to read script body: {err}"))?;
    if content.trim().is_empty() {
        return Err(format!("Lua script for AppID {appid} is empty"));
    }

    Ok(vec![(format!("{appid}.lua"), content)])
}

// ==================== DEPOTBOX VALIDATION ====================

/// Response item from DepotBox `/validate/all` for a depot decryption key.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct DepotboxDepotKeyResult {
    pub depot_id: u64,
    pub valid: bool,
}

/// Response item from DepotBox `/validate/all` for an app/package token.
/// Only one of `app_id` / `package_id` is present depending on the list.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct DepotboxTokenResult {
    #[serde(default)]
    pub app_id: Option<u64>,
    #[serde(default)]
    pub package_id: Option<u64>,
    pub valid: bool,
}

/// Response item from DepotBox `/validate/all` for a manifest id.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct DepotboxManifestResult {
    pub depot_id: u64,
    pub manifest_id: String,
    pub current: bool,
    #[serde(default)]
    pub latest_manifest_id: Option<String>,
}

/// Aggregated response of the DepotBox `/validate/all` endpoint.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case", default)]
pub struct DepotboxValidateReport {
    pub depot_keys: Vec<DepotboxDepotKeyResult>,
    pub app_tokens: Vec<DepotboxTokenResult>,
    pub package_tokens: Vec<DepotboxTokenResult>,
    pub manifests: Vec<DepotboxManifestResult>,
}

/// Validate a Lua/VDF text blob against the DepotBox public validation API
/// (`POST /validate/all`, `{ "text": ..., "turnstileToken": ... }`).
///
/// The API is gated by a Cloudflare Turnstile captcha for non-premium users:
/// the frontend solves the widget (sitekey lives in the Turnstile component)
/// and passes the resulting token here. When the token is missing/invalid the
/// server answers 403 `{code: "captcha_required"}` which we surface with a
/// `DEPOTBOX_CAPTCHA_REQUIRED` prefix so the UI can show the widget.
///
/// HTTPS is tried first, then plain HTTP (the documented base URL), so the
/// feature keeps working if only one of the two is reachable.
pub async fn validate_depotbox_lua(
    text: &str,
    turnstile_token: Option<&str>,
) -> Result<DepotboxValidateReport> {
    let client = reqwest::Client::new();
    let mut body = serde_json::json!({ "text": text.trim() });
    if let Some(token) = turnstile_token.map(str::trim).filter(|token| !token.is_empty()) {
        body["turnstileToken"] = serde_json::Value::String(token.to_string());
    }

    let mut last_error = None;
    for base in [
        "https://depotbox.org/api/tools/v1",
        "http://depotbox.org/api/tools/v1",
    ] {
        let response = client
            .post(format!("{base}/validate/all"))
            .header("Content-Type", "application/json")
            .header("User-Agent", "Micah0xC-App")
            .json(&body)
            .send()
            .await;

        let response = match response {
            Ok(response) => response,
            Err(err) => {
                last_error = Some(format!("DepotBox API unreachable: {err}"));
                continue;
            }
        };

        if !response.status().is_success() {
            let status = response.status();
            let err_body: Value = response.json().await.unwrap_or(Value::Null);
            let code = err_body
                .get("code")
                .and_then(Value::as_str)
                .unwrap_or("");
            let message = err_body
                .get("error")
                .and_then(Value::as_str)
                .unwrap_or("DepotBox API returned an error");
            if code == "captcha_required" {
                return Err("DEPOTBOX_CAPTCHA_REQUIRED".into());
            }
            return Err(format!("DepotBox error ({status}): {message}").into());
        }

        return response
            .json::<DepotboxValidateReport>()
            .await
            .map_err(|err| format!("Failed to parse DepotBox response: {err}").into());
    }

    Err(last_error
        .unwrap_or_else(|| "DepotBox API unreachable".to_string())
        .into())
}


/// Fetch a single Lua file from the OpenLua API.
///
/// The API is protected by Cloudflare Turnstile: the frontend solves the
/// challenge and hands us the resulting token, which is forwarded as the
/// `X-Turnstile-Token` header. We also send a browser fingerprint header
/// (obtained from `GET /fingerprint`) plus an `X-Client-Data` signal blob so
/// the API behaves as it does for the official web app.
///
/// Progress is streamed to the frontend via the `openlua://progress` event
/// ("sending" -> "downloading" -> done). On failure the API returns a JSON
/// body with an `error_code`/`error` pair which we surface as a human message.
pub async fn fetch_openlua_lua_file(
    app: &tauri::AppHandle,
    file_id: &str,
    captcha_token: &str,
) -> Result<String> {
    use tauri::Emitter;

    let file_id = file_id.trim();
    if file_id.is_empty() {
        return Err("File ID must not be empty".into());
    }
    if captcha_token.trim().is_empty() {
        return Err("Captcha token is required before downloading".into());
    }

    let client = reqwest::Client::new();

    // 1. Obtain a browser fingerprint from the API.
    app.emit("openlua://progress", "sending").ok();
    let fingerprint_resp = client
        .get(format!("{OPENLUA_API_BASE}{OPENLUA_FINGERPRINT_PATH}"))
        .send()
        .await
        .map_err(|err| format!("OpenLua: failed to contact API: {err}"))?;
    if !fingerprint_resp.status().is_success() {
        return Err(format!(
            "OpenLua: fingerprint request failed with status {}",
            fingerprint_resp.status()
        ));
    }
    let fingerprint_body: Value = fingerprint_resp
        .json()
        .await
        .map_err(|err| format!("OpenLua: failed to parse fingerprint response: {err}"))?;
    let fingerprint = fingerprint_body
        .get("fingerprint")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "OpenLua: missing fingerprint in response".to_string())?
        .to_string();

    // 2. Download the file, authenticated by the captcha token.
    app.emit("openlua://progress", "downloading").ok();
    let request = client
        .get(format!("{OPENLUA_API_BASE}{OPENLUA_DOWNLOAD_PATH}{file_id}"))
        .header("X-Turnstile-Token", captcha_token.trim())
        .header("X-Browser-Fingerprint", &fingerprint)
        .header("X-Client-Data", "MDAwMDAwMA==");

    let response = request
        .send()
        .await
        .map_err(|err| format!("OpenLua: download request failed: {err}"))?;
    let status = response.status();

    if status.is_success() {
        let content_type = response
            .headers()
            .get(reqwest::header::CONTENT_TYPE)
            .and_then(|v| v.to_str().ok())
            .unwrap_or("")
            .to_string();

        // The API answers a successful redirect with `{redirect, url}` JSON
        // (e.g. an ad gateway before the actual file). Follow it.
        if content_type.contains("json") {
            let body: Value = response
                .json()
                .await
                .map_err(|err| format!("OpenLua: failed to parse redirect response: {err}"))?;
            let redirect_url = body
                .get("url")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            if !redirect_url.is_empty() {
                let absolute = if redirect_url.starts_with("http") {
                    redirect_url
                } else {
                    format!("{OPENLUA_API_BASE}{redirect_url}")
                };
                let final_resp = client
                    .get(&absolute)
                    .send()
                    .await
                    .map_err(|err| format!("OpenLua: failed to follow redirect: {err}"))?;
                if !final_resp.status().is_success() {
                    return Err(format!(
                        "OpenLua: redirected download failed with status {}",
                        final_resp.status()
                    ));
                }
                let bytes = final_resp
                    .bytes()
                    .await
                    .map_err(|err| format!("OpenLua: failed to read file body: {err}"))?;
                return String::from_utf8(bytes.to_vec())
                    .map_err(|_| "OpenLua: downloaded file is not valid UTF-8".to_string());
            }
            return Err("OpenLua: unexpected JSON response instead of file".into());
        }

        let bytes = response
            .bytes()
            .await
            .map_err(|err| format!("OpenLua: failed to read file body: {err}"))?;
        return String::from_utf8(bytes.to_vec())
            .map_err(|_| "OpenLua: downloaded file is not valid UTF-8".to_string());
    }

    let body: Value = response.json().await.unwrap_or(Value::Null);
    let code = body.get("error_code").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let detail = body.get("error").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let message = match (status.as_u16(), code.as_str()) {
        (404, "NOT_FOUND") => format!("File not found for AppID {file_id}"),
        (429, _) => "Rate limited — wait a moment".into(),
        (403, "ACCESS_DENIED") | (403, "AUTH_REQUIRED") | (403, "VPN_BLOCKED") => {
            format!("Download blocked: {}", if detail.is_empty() { code } else { detail })
        }
        (_, "CAPTCHA_FAILED") | (_, "CAPTCHA_REQUIRED") => {
            "Captcha token was rejected — solve the challenge again".into()
        }
        _ => format!("{} (HTTP {status})", if detail.is_empty() { code } else { detail }),
    };
    Err(message)
}


#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenLuaTestResult {
    pub valid: bool,
    pub error_code: Option<String>,
    pub message: String,
    pub content_ok: bool,
}

/// Heuristic check: does the downloaded payload look like a real Lua script?
fn lua_payload_ok(text: &str) -> bool {
    let trimmed = text.trim();
    !trimmed.is_empty()
        && (trimmed.starts_with("--")
            || trimmed.starts_with("addappid(")
            || trimmed.starts_with("setManifestid("))
}


/// Probe the OpenLua API with a given captcha token *without* importing
/// anything. Reports whether the token is accepted and whether the returned
/// payload looks like a real Lua script (spell-checker for the captcha step).
pub async fn test_openlua_token(
    _app: &tauri::AppHandle,
    file_id: &str,
    captcha_token: &str,
) -> Result<OpenLuaTestResult> {
    let file_id = file_id.trim();
    let captcha_token = captcha_token.trim();
    if file_id.is_empty() {
        return Err("File ID must not be empty".into());
    }
    if captcha_token.is_empty() {
        return Ok(OpenLuaTestResult {
            valid: false,
            error_code: Some("CAPTCHA_REQUIRED".into()),
            message: "No captcha token provided".into(),
            content_ok: false,
        });
    }

    let client = reqwest::Client::new();
    let fingerprint_resp = client
        .get(format!("{OPENLUA_API_BASE}{OPENLUA_FINGERPRINT_PATH}"))
        .send()
        .await
        .map_err(|err| format!("OpenLua: failed to contact API: {err}"))?;
    let fingerprint_body: Value = fingerprint_resp
        .json()
        .await
        .map_err(|err| format!("OpenLua: failed to parse fingerprint response: {err}"))?;
    let fingerprint = fingerprint_body
        .get("fingerprint")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "OpenLua: missing fingerprint in response".to_string())?
        .to_string();

    let response = client
        .get(format!("{OPENLUA_API_BASE}{OPENLUA_DOWNLOAD_PATH}{file_id}"))
        .header("X-Turnstile-Token", captcha_token)
        .header("X-Browser-Fingerprint", &fingerprint)
        .header("X-Client-Data", "MDAwMDAwMA==")
        .send()
        .await
        .map_err(|err| format!("OpenLua: download request failed: {err}"))?;
    let status = response.status();

    if status.is_success() {
        let content_type = response
            .headers()
            .get(reqwest::header::CONTENT_TYPE)
            .and_then(|v| v.to_str().ok())
            .unwrap_or("")
            .to_string();
        let bytes = response.bytes().await.unwrap_or_default();
        if content_type.contains("json") {
            let body: Value = serde_json::from_slice(&bytes).unwrap_or(Value::Null);
            let url = body.get("url").and_then(|v| v.as_str()).unwrap_or("").to_string();
            if !url.is_empty() {
                // Follow the redirect and validate the final payload.
                let absolute = if url.starts_with("http") {
                    url
                } else {
                    format!("{OPENLUA_API_BASE}{url}")
                };
                match client.get(&absolute).send().await {
                    Ok(final_resp) if final_resp.status().is_success() => {
                        let bytes = final_resp.bytes().await.unwrap_or_default();
                        let text = String::from_utf8(bytes.to_vec()).unwrap_or_default();
                        return Ok(OpenLuaTestResult {
                            valid: true,
                            error_code: None,
                            message: "Captcha accepted; payload looks valid".into(),
                            content_ok: lua_payload_ok(&text),
                        });
                    }
                    _ => {
                        return Ok(OpenLuaTestResult {
                            valid: true,
                            error_code: None,
                            message: "Captcha accepted but the download redirect failed".into(),
                            content_ok: false,
                        })
                    }
                }
            }
        }
        let text = String::from_utf8(bytes.to_vec()).unwrap_or_default();
        return Ok(OpenLuaTestResult {
            valid: true,
            error_code: None,
            message: "Captcha accepted; token is valid".into(),
            content_ok: lua_payload_ok(&text),
        });
    }

    let bytes = response.bytes().await.unwrap_or_default();
    let body: Value = serde_json::from_slice(&bytes).unwrap_or(Value::Null);
    let code = body.get("error_code").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let detail = body.get("error").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let (valid, message) = match (status.as_u16(), code.as_str()) {
        (404, "NOT_FOUND") => (false, format!("File not found for AppID {file_id}")),
        (429, _) => (false, "Rate limited — wait a moment".into()),
        (403, "ACCESS_DENIED") | (403, "AUTH_REQUIRED") | (403, "VPN_BLOCKED") => (
            false,
            format!("Download blocked: {}", if detail.is_empty() { &code } else { &detail }),
        ),
        (_, "CAPTCHA_FAILED") | (_, "CAPTCHA_REQUIRED") => (
            false,
            "Captcha token was rejected — solve the challenge again".into(),
        ),
        _ => (false, format!("{} (HTTP {status})", if detail.is_empty() { &code } else { &detail })),
    };
    Ok(OpenLuaTestResult {
        valid,
        error_code: Some(code),
        message,
        content_ok: false,
    })
}


pub fn open_lua_dir_for_steam<P: AsRef<Path>>(steam_dir: P) -> Result<()> {
    let steam_dir = validate_steam_dir(steam_dir)?;
    let lua_dir = lua_dir(&steam_dir);
    fs::create_dir_all(&lua_dir).map_err(|err| err.to_string())?;
    open_dir(&lua_dir)
}

pub fn render_game_lua(game: &GameConfig) -> Result<String> {
    validate_game(game)?;
    let meta = serde_json::to_string(game).map_err(|err| err.to_string())?;
    let mut lines = vec![
        format!("-- G-Micah_Mode: {} {}", game.appid, game.name.trim()),
        format!("{META_PREFIX}{meta}"),
    ];

    for entry in normalized_appid_entries(game) {
        match (entry.unlock_flag, clean_opt(&entry.depot_key)) {
            (Some(flag), Some(key)) => {
                lines.push(format!("addappid({}, {}, \"{}\")", entry.appid, flag, key))
            }
            (Some(flag), None) => lines.push(format!("addappid({}, {})", entry.appid, flag)),
            (None, Some(key)) => lines.push(format!("addappid({}, 0, \"{}\")", entry.appid, key)),
            (None, None) => lines.push(format!("addappid({})", entry.appid)),
        }
    }
    if let Some(token) = clean_opt(&game.access_token) {
        lines.push(format!("addtoken({}, \"{}\")", game.appid, token));
    }
    let manifest_entries = normalized_manifest_entries(game);
    if !manifest_entries.is_empty() {
        for entry in manifest_entries {
            lines.push(format!(
                "setManifestid({}, \"{}\")",
                entry.depot_id, entry.manifest_gid
            ));
        }
    } else if let Some(gid) = clean_opt(&game.manifest_gid) {
        lines.push(format!("setManifestid({}, \"{}\")", game.appid, gid));
    }
    if let Some(ticket) = clean_opt(&game.app_ticket_hex) {
        lines.push(format!("setAppTicket({}, \"{}\")", game.appid, ticket));
    }
    if let Some(ticket) = clean_opt(&game.e_ticket_hex) {
        lines.push(format!("setETicket({}, \"{}\")", game.appid, ticket));
    }
    if let Some(steam_id) = clean_opt(&game.stat_steam_id) {
        lines.push(format!("setStat({}, \"{}\")", game.appid, steam_id));
    }
    lines.push(String::new());
    Ok(lines.join("\n"))
}

fn parse_game_lua(file_name: &str, text: &str) -> Option<GameConfig> {
    if let Some(mut game) = text.lines().find_map(|line| {
        line.strip_prefix(META_PREFIX)
            .and_then(|json| serde_json::from_str::<GameConfig>(json).ok())
    }) {
        let manifest_entries = find_manifest_entries(text);
        if game.manifest_entries.is_empty() && !manifest_entries.is_empty() {
            game.manifest_entries = manifest_entries;
        }
        return Some(game);
    }
    parse_legacy_game_lua(file_name, text)
}

fn parse_legacy_game_lua(file_name: &str, text: &str) -> Option<GameConfig> {
    let mut entries = find_addappid_entries(text);
    // TestBELUA-style `setDepotKey(depot, "key")` lines carry keys outside addappid.
    for (depot_id, key) in find_set_depot_keys(text) {
        match entries.iter_mut().find(|entry| entry.appid == depot_id) {
            Some(entry) if entry.depot_key.is_none() => entry.depot_key = Some(key),
            None => entries.push(AppIdEntry {
                appid: depot_id,
                unlock_flag: Some(0),
                depot_key: Some(key),
            }),
            _ => {}
        }
    }
    let appid = appid_from_g_lua_name(file_name)
        .or_else(|| find_comment_value(text, "AppId").and_then(|value| value.parse().ok()))
        .or_else(|| entries.first().map(|entry| entry.appid))?;
    let name = find_comment_value(text, "Name")
        .or_else(|| find_comment_value(text, "备注"))
        .unwrap_or_else(|| format!("App {appid}"));
    let depot_key = entries
        .iter()
        .find(|entry| entry.appid == appid)
        .and_then(|entry| entry.depot_key.clone());

    let manifest_entries = find_manifest_entries(text);
    let manifest_gid = manifest_entries
        .first()
        .map(|entry| entry.manifest_gid.clone())
        .or_else(|| find_first_quoted_arg(text, "setManifestid("));

    Some(GameConfig {
        appid,
        name,
        enabled: true,
        depot_key,
        access_token: find_first_quoted_arg(text, "addtoken("),
        manifest_gid,
        app_ticket_hex: find_first_quoted_arg(text, "setAppTicket("),
        e_ticket_hex: find_first_quoted_arg(text, "setETicket("),
        stat_steam_id: find_first_quoted_arg(text, "setStat("),
        appid_entries: entries,
        manifest_entries,
    })
}

fn appid_from_g_lua_name(file_name: &str) -> Option<u32> {
    // Accepts both managed `G-{appid}.lua[.disabled]` and bare TestBELUA
    // output `{appid}.lua`. The numeric parse rejects anything else.
    let stem = file_name.strip_prefix("G-").unwrap_or(file_name);
    stem
        .strip_suffix(".lua")
        .or_else(|| stem.strip_suffix(".lua.disabled"))
        .and_then(|appid| appid.parse().ok())
}

fn find_set_depot_keys(text: &str) -> Vec<(u32, String)> {
    let mut out = Vec::new();
    for args in find_call_args(text, "setDepotKey(") {
        let parts = split_lua_args(&args);
        let (Some(depot_id), Some(key)) = (
            parts.first().and_then(|value| value.trim().parse().ok()),
            parts
                .get(1)
                .map(|value| value.trim())
                .and_then(unquote_lua_string),
        ) else {
            continue;
        };
        if !key.is_empty() {
            out.push((depot_id, key));
        }
    }
    out
}

fn find_comment_value(text: &str, key: &str) -> Option<String> {
    let prefix = format!("-- {}:", key);
    text.lines()
        .find_map(|line| line.trim().strip_prefix(&prefix).map(str::trim))
        .filter(|value| !value.is_empty())
        .map(ToString::to_string)
}

fn find_addappid_entries(text: &str) -> Vec<AppIdEntry> {
    let mut entries = Vec::new();
    for args in find_call_args(text, "addappid(") {
        let parts = split_lua_args(&args);
        let Some(appid) = parts.first().and_then(|value| value.trim().parse().ok()) else {
            continue;
        };
        entries.push(AppIdEntry {
            appid,
            unlock_flag: parts.get(1).and_then(|value| value.trim().parse().ok()),
            depot_key: parts
                .get(2)
                .map(|value| value.trim())
                .and_then(unquote_lua_string),
        });
    }
    entries
}

fn find_manifest_entries(text: &str) -> Vec<ManifestEntry> {
    let mut entries = Vec::new();
    for args in find_call_args(text, "setManifestid(") {
        let parts = split_lua_args(&args);
        let Some(depot_id) = parts.first().and_then(|value| value.trim().parse().ok()) else {
            continue;
        };
        let Some(manifest_gid) = parts
            .get(1)
            .map(|value| value.trim())
            .and_then(unquote_lua_string)
        else {
            continue;
        };
        entries.push(ManifestEntry {
            depot_id,
            manifest_gid,
        });
    }
    entries
}

fn find_call_args(text: &str, marker: &str) -> Vec<String> {
    text.split(marker)
        .skip(1)
        .filter_map(|segment| segment.split_once(')').map(|(args, _)| args.to_string()))
        .collect()
}

fn split_lua_args(args: &str) -> Vec<String> {
    let mut result = Vec::new();
    let mut current = String::new();
    let mut in_string = false;
    let mut escaped = false;
    for character in args.chars() {
        if escaped {
            current.push(character);
            escaped = false;
            continue;
        }
        if character == '\\' && in_string {
            current.push(character);
            escaped = true;
            continue;
        }
        if character == '"' {
            in_string = !in_string;
            current.push(character);
            continue;
        }
        if character == ',' && !in_string {
            result.push(current.trim().to_string());
            current.clear();
            continue;
        }
        current.push(character);
    }
    if !current.trim().is_empty() {
        result.push(current.trim().to_string());
    }
    result
}

fn unquote_lua_string(value: &str) -> Option<String> {
    value
        .strip_prefix('"')
        .and_then(|value| value.strip_suffix('"'))
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToString::to_string)
}

fn find_first_quoted_arg(text: &str, marker: &str) -> Option<String> {
    for segment in text.split(marker).skip(1) {
        let mut quoted = segment.split('"').skip(1);
        if let Some(value) = quoted
            .next()
            .map(str::trim)
            .filter(|value| !value.is_empty())
        {
            return Some(value.to_string());
        }
    }
    None
}

fn normalized_appid_entries(game: &GameConfig) -> Vec<AppIdEntry> {
    if !game.appid_entries.is_empty() {
        return game.appid_entries.clone();
    }
    vec![AppIdEntry {
        appid: game.appid,
        unlock_flag: clean_opt(&game.depot_key).map(|_| 0),
        depot_key: clean_opt(&game.depot_key),
    }]
}

fn normalized_manifest_entries(game: &GameConfig) -> Vec<ManifestEntry> {
    game.manifest_entries
        .iter()
        .filter_map(|entry| {
            clean_opt(&Some(entry.manifest_gid.clone())).map(|manifest_gid| ManifestEntry {
                depot_id: entry.depot_id,
                manifest_gid,
            })
        })
        .collect()
}

fn clean_opt(value: &Option<String>) -> Option<String> {
    value
        .as_ref()
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty())
}

// ==================== SETTINGS MANAGEMENT ====================

pub fn load_settings_from_dir<P: AsRef<Path>>(steam_dir: P) -> Result<ManagerSettings> {
    let steam_dir = validate_steam_dir(steam_dir)?;
    let path = steam_dir.join("micah_mode.toml");
    if !path.exists() {
        return Ok(ManagerSettings::default());
    }

    let text = fs::read_to_string(path).map_err(|err| err.to_string())?;
    let value: toml::Value = toml::from_str(&text).map_err(|err| err.to_string())?;
    let mut settings = ManagerSettings::default();

    if let Some(log) = value.get("log").and_then(|v| v.as_table()) {
        if let Some(level) = log.get("level").and_then(|v| v.as_str()) {
            settings.log_level = level.to_string();
        }
    }
    if let Some(manifest) = value.get("manifest").and_then(|v| v.as_table()) {
        if let Some(url) = manifest.get("url").and_then(|v| v.as_str()) {
            settings.manifest_url = url.to_string();
        }
        settings.timeout_resolve_ms =
            read_u64(manifest, "timeout_resolve_ms", settings.timeout_resolve_ms);
        settings.timeout_connect_ms =
            read_u64(manifest, "timeout_connect_ms", settings.timeout_connect_ms);
        settings.timeout_send_ms = read_u64(manifest, "timeout_send_ms", settings.timeout_send_ms);
        settings.timeout_recv_ms = read_u64(manifest, "timeout_recv_ms", settings.timeout_recv_ms);
    }
    if let Some(lua) = value.get("lua").and_then(|v| v.as_table()) {
        if let Some(paths) = lua.get("paths").and_then(|v| v.as_array()) {
            settings.lua_paths = paths
                .iter()
                .filter_map(|entry| entry.as_str().map(ToString::to_string))
                .collect();
        }
    }
    if let Some(pattern) = value.get("pattern").and_then(|v| v.as_table()) {
        if let Some(mirror) = pattern.get("mirror").and_then(|v| v.as_str()) {
            settings.pattern_mirror = mirror.to_string();
        }
    }

    Ok(settings)
}

pub fn save_settings_to_dir<P: AsRef<Path>>(
    steam_dir: P,
    settings: &ManagerSettings,
) -> Result<()> {
    let steam_dir = validate_steam_dir(steam_dir)?;
    validate_settings(settings)?;
    let lua_paths = settings
        .lua_paths
        .iter()
        .map(|path| format!("\"{}\"", escape_toml(path)))
        .collect::<Vec<_>>()
        .join(", ");
    let mut text = format!(
        "[log]\nlevel = \"{}\"\n\n[manifest]\nurl = \"{}\"\ntimeout_resolve_ms = {}\ntimeout_connect_ms = {}\ntimeout_send_ms = {}\ntimeout_recv_ms = {}\n\n[lua]\npaths = [{}]\n",
        escape_toml(&settings.log_level),
        escape_toml(&settings.manifest_url),
        settings.timeout_resolve_ms,
        settings.timeout_connect_ms,
        settings.timeout_send_ms,
        settings.timeout_recv_ms,
        lua_paths
    );
    if !settings.pattern_mirror.trim().is_empty() {
        text.push_str(&format!(
            "\n[pattern]\nmirror = \"{}\"\n",
            escape_toml(settings.pattern_mirror.trim())
        ));
    }
    fs::write(steam_dir.join("micah_mode.toml"), text).map_err(|err| err.to_string())
}

fn read_u64(table: &toml::map::Map<String, toml::Value>, key: &str, default: u64) -> u64 {
    table
        .get(key)
        .and_then(|v| v.as_integer())
        .and_then(|v| u64::try_from(v).ok())
        .unwrap_or(default)
}

fn validate_settings(settings: &ManagerSettings) -> Result<()> {
    if !["trace", "debug", "info", "warn", "error"].contains(&settings.log_level.as_str()) {
        return Err("Invalid log level".into());
    }
    if !["steamrun", "wudrm"].contains(&settings.manifest_url.as_str()) {
        return Err("Invalid manifest source".into());
    }
    Ok(())
}

fn validate_game(game: &GameConfig) -> Result<()> {
    if game.appid == 0 {
        return Err("AppId must be greater than zero".into());
    }
    if let Some(key) = clean_opt(&game.depot_key) {
        if key.len() != 64 || !key.chars().all(|c| c.is_ascii_hexdigit()) {
            return Err("Depot key must be 64 hex characters".into());
        }
    }
    for entry in &game.appid_entries {
        if entry.appid == 0 {
            return Err("addappid entry AppId must be greater than zero".into());
        }
        if let Some(key) = clean_opt(&entry.depot_key) {
            if key.len() != 64 || !key.chars().all(|c| c.is_ascii_hexdigit()) {
                return Err("Depot key must be 64 hex characters".into());
            }
        }
    }
    for entry in &game.manifest_entries {
        if entry.depot_id == 0 {
            return Err("Manifest Depot ID must be greater than zero".into());
        }
        if !entry.manifest_gid.chars().all(|c| c.is_ascii_digit()) {
            return Err("manifest gid must contain digits only".into());
        }
    }
    for (label, value) in [
        ("access token", &game.access_token),
        ("manifest gid", &game.manifest_gid),
        ("stat steam id", &game.stat_steam_id),
    ] {
        if let Some(value) = clean_opt(value) {
            if !value.chars().all(|c| c.is_ascii_digit()) {
                return Err(format!("{label} must contain digits only"));
            }
        }
    }
    for (label, value) in [
        ("AppTicket", &game.app_ticket_hex),
        ("ETicket", &game.e_ticket_hex),
    ] {
        if let Some(value) = clean_opt(value) {
            if !value.chars().all(|c| c.is_ascii_hexdigit()) {
                return Err(format!("{label} must be hex"));
            }
        }
    }
    Ok(())
}

fn escape_toml(value: &str) -> String {
    value.replace('\\', "\\\\").replace('"', "\\\"")
}


pub fn read_logs_from_dir<P: AsRef<Path>>(steam_dir: P) -> Result<Vec<LogFile>> {
    let steam_dir = validate_steam_dir(steam_dir)?;
    let log_dir = steam_dir.join("micah_mode");
    if !log_dir.is_dir() {
        return Ok(Vec::new());
    }
    let mut logs = Vec::new();
    for entry in fs::read_dir(log_dir).map_err(|err| err.to_string())? {
        let entry = entry.map_err(|err| err.to_string())?;
        let path = entry.path();
        if path.extension().and_then(OsStr::to_str) != Some("log") {
            continue;
        }
        let name = path
            .file_name()
            .and_then(OsStr::to_str)
            .unwrap_or("unknown.log")
            .to_string();
        let metadata = fs::metadata(&path).map_err(|err| err.to_string())?;
        let size_bytes = metadata.len();
        let modified_time = metadata.modified().ok().and_then(system_time_secs);
        // Read only the tail of large files (most recent activity) instead of
        // the whole file, then cutting it down.
        let content = if size_bytes <= MAX_LOG_TAIL {
            fs::read_to_string(&path).unwrap_or_else(|_| String::new())
        } else {
            read_log_tail(&path)
        };
        let line_count = content.lines().count();
        logs.push(LogFile {
            name,
            content,
            size_bytes,
            modified_time,
            line_count,
        });
    }
    logs.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(logs)
}

/// Read the last MAX_LOG_TAIL bytes of a log file, trimmed at the first
/// newline so the content starts on a clean line boundary.
fn read_log_tail(path: &Path) -> String {
    let Ok(mut file) = fs::File::open(path) else {
        return String::new();
    };
    if file.seek(SeekFrom::End(-(MAX_LOG_TAIL as i64))).is_err() {
        return String::new();
    }
    let mut buf = Vec::new();
    if file.read_to_end(&mut buf).is_err() {
        return String::new();
    }
    let tail = String::from_utf8_lossy(&buf).into_owned();
    match tail.find('\n') {
        Some(pos) => tail[pos + 1..].to_string(),
        None => tail,
    }
}

fn list_log_names(steam_dir: &Path) -> Vec<String> {
    // Metadata-only: list .log file names without reading their contents.
    let Ok(entries) = fs::read_dir(steam_dir.join("micah_mode")) else {
        return Vec::new();
    };
    let mut names = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(OsStr::to_str) == Some("log") {
            if let Some(name) = path.file_name().and_then(OsStr::to_str) {
                names.push(name.to_string());
            }
        }
    }
    names.sort();
    names
}

fn system_time_secs(time: SystemTime) -> Option<u64> {
    time.duration_since(UNIX_EPOCH)
        .ok()
        .map(|duration| duration.as_secs())
}


pub async fn fetch_app_metadata(appid: u32) -> Result<AppMetadata> {
    if appid == 0 {
        return Err("AppId must be greater than zero".into());
    }
    // SteamSpy API — works when store.steampowered.com is blocked
    let url = format!("https://steamspy.com/api.php?request=appdetails&appid={appid}");
    let value: Value = reqwest::Client::new()
        .get(&url)
        .timeout(STORE_FETCH_TIMEOUT)
        .send()
        .await
        .map_err(|err| err.to_string())?
        .json()
        .await
        .map_err(|err| err.to_string())?;
    let name = value
        .get("name")
        .and_then(Value::as_str)
        .unwrap_or("")
        .trim()
        .to_string();
    if name.is_empty() {
        return Err("SteamSpy did not return an app name".into());
    }
    Ok(AppMetadata {
        appid,
        name,
        source: "steamspy.com".into(),
    })
}

pub async fn search_steam_games(query: &str) -> Result<Vec<SearchResult>> {
    if query.trim().len() < 2 {
        return Ok(Vec::new());
    }
    // Primary: CheapShark games API — reachable even where Steam domains are
    // DNS-blocked. Returns steamAppID + external (name) + thumb.
    // (CheapShark rejects generic User-Agents, so identify the client.)
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(8))
        .user_agent("Micah0xC/1.0 (+https://github.com/0xcRachel/Micah_0xC)")
        .build()
        .map_err(|err| err.to_string())?;
    let cheap_url = format!(
        "https://www.cheapshark.com/api/1.0/games?title={}&limit=10",
        urlencoding::encode(query)
    );
    if let Ok(resp) = client.get(&cheap_url).send().await {
        if let Ok(value) = resp.json::<Value>().await {
            let results = parse_cheapshark_results(&value, query);
            if !results.is_empty() {
                return Ok(results);
            }
        }
    }
    // Fallback: Steam Community SearchApps API (works where not blocked)
    let url = format!(
        "https://steamcommunity.com/actions/SearchApps/{}",
        urlencoding::encode(query)
    );
    let community_client = reqwest::Client::builder()
        .timeout(Duration::from_secs(8))
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        .build()
        .map_err(|err| err.to_string())?;
    let value: Value = community_client
        .get(&url)
        .send()
        .await
        .map_err(|err| format!("Steam search request failed: {err}"))?
        .json()
        .await
        .map_err(|err| format!("Steam search parse failed: {err}"))?;
    let items = value.as_array().cloned().unwrap_or_default();
    let mut results = Vec::new();
    for item in items.into_iter().take(8) {
        // appid comes as a string from this API
        let appid: u32 = item
            .get("appid")
            .and_then(Value::as_str)
            .and_then(|s| s.parse().ok())
            .unwrap_or(0);
        let name = item
            .get("name")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string();
        let header_image = item
            .get("logo")
            .and_then(Value::as_str)
            .map(String::from)
            .unwrap_or_else(|| {
                format!(
                    "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/{appid}/header.jpg"
                )
            });
        if appid > 0 && !name.is_empty() {
            results.push(SearchResult {
                appid,
                name,
                header_image,
            });
        }
    }
    Ok(results)
}

/// Parse CheapShark `/games?title=` results into SearchResults.
/// steamAppID may be a string, a number, or null (bundles/DLC-only
/// entries have null and are skipped).
fn parse_cheapshark_results(value: &Value, query: &str) -> Vec<SearchResult> {
    let mut results = Vec::new();
    let needle = query.trim().to_lowercase();
    let items = value.as_array().cloned().unwrap_or_default();
    for item in items.into_iter() {
        let appid: u32 = item
            .get("steamAppID")
            .and_then(|v| {
                v.as_str()
                    .and_then(|s| s.parse().ok())
                    .or_else(|| v.as_u64().and_then(|n| u32::try_from(n).ok()))
            })
            .unwrap_or(0);
        let name = item
            .get("external")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string();
        if appid == 0 || name.is_empty() {
            continue;
        }
        let header_image = item
            .get("thumb")
            .and_then(Value::as_str)
            .filter(|s| !s.is_empty())
            .map(String::from)
            .unwrap_or_else(|| {
                format!(
                    "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/{appid}/header.jpg"
                )
            });
        results.push(SearchResult {
            appid,
            name,
            header_image,
        });
        if results.len() >= 8 {
            break;
        }
    }
    // Rank prefix matches first (stable — API order kept within each group).
    results.sort_by_key(|r| !r.name.to_lowercase().starts_with(&needle));
    results
}

pub async fn get_steam_game_detail(appid: u32) -> Result<GameDetail> {
    if appid == 0 {
        return Err("AppId must be greater than zero".into());
    }
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(8))
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        .build()
        .map_err(|err| err.to_string())?;

    // SteamSpy API — works when store.steampowered.com is blocked
    let spy_url = format!(
        "https://steamspy.com/api.php?request=appdetails&appid={appid}"
    );
    let data: Value = client
        .get(&spy_url)
        .send()
        .await
        .map_err(|err| format!("SteamSpy request failed: {err}"))?
        .json()
        .await
        .map_err(|err| format!("SteamSpy parse failed: {err}"))?;

    let name = data
        .get("name")
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string();
    let header_image = format!(
        "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/{appid}/header.jpg"
    );

    // SteamSpy returns comma-separated strings for developer/publisher/genre
    let developers: Vec<String> = data
        .get("developer")
        .and_then(Value::as_str)
        .unwrap_or("")
        .split(',')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();
    let publishers: Vec<String> = data
        .get("publisher")
        .and_then(Value::as_str)
        .unwrap_or("")
        .split(',')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();
    let genres: Vec<String> = data
        .get("genre")
        .and_then(Value::as_str)
        .unwrap_or("")
        .split(',')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();

    // SteamSpy tags object → extract keys as categories
    let categories: Vec<String> = data
        .get("tags")
        .and_then(Value::as_object)
        .map(|obj| {
            obj.keys()
                .take(10)
                .map(|k| k.to_string())
                .collect()
        })
        .unwrap_or_default();

    let positive = data.get("positive").and_then(Value::as_u64).unwrap_or(0);
    let negative = data.get("negative").and_then(Value::as_u64).unwrap_or(0);
    let total = positive + negative;
    let review_score = if total > 0 {
        ((positive as f64 / total as f64) * 100.0).round() as u32
    } else {
        0
    };
    let score_label = if total > 0 {
        let pct = (positive as f64 / total as f64) * 100.0;
        if pct >= 95.0 {
            "Overwhelmingly Positive"
        } else if pct >= 80.0 {
            "Very Positive"
        } else if pct >= 70.0 {
            "Mostly Positive"
        } else if pct >= 50.0 {
            "Mixed"
        } else if pct >= 20.0 {
            "Mostly Negative"
        } else {
            "Overwhelmingly Negative"
        }
    } else {
        "N/A"
    };

    // SteamSpy price is in cents as a string (e.g. "1499")
    let price = data
        .get("price")
        .and_then(Value::as_str)
        .map(|s| {
            let cents: u64 = s.parse().unwrap_or(0);
            if cents == 0 {
                "Free".to_string()
            } else {
                format!("${:.2}", cents as f64 / 100.0)
            }
        })
        .unwrap_or_else(|| "N/A".to_string());

    Ok(GameDetail {
        appid,
        name,
        header_image,
        developers,
        publishers,
        genres,
        categories,
        metacritic: 0,
        score: review_score,
        score_label: score_label.to_string(),
        price,
        short_description: String::new(),
        release_date: String::new(),
        pc_requirements_minimum: String::new(),
        pc_requirements_recommended: String::new(),
    })
}

/// ── manifest gid refresh (steamcmd.net) ────────────────────────────────
///
/// Steam answers manifest downloads with 401 once a Lua pins a superseded
/// manifest gid (games update → the public branch moves on). steamcmd.net
/// mirrors live PICS data including CURRENT public gids per depot, and is
/// reachable from networks where Steam Store domains are DNS-blocked.

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ManifestRefreshEntry {
    pub depot_id: u32,
    pub old_gid: String,
    pub new_gid: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ManifestRefreshResult {
    pub appid: u32,
    pub updated: Vec<ManifestRefreshEntry>,
    pub unchanged: u32,
    pub files_written: Vec<String>,
    pub warnings: Vec<String>,
}

/// Current public manifest gids per depot from the steamcmd.net PICS mirror.
/// Returns (depot_id, gid) pairs; depots without a public manifest are skipped.
pub async fn fetch_steamcmd_public_gids(appid: u32) -> Result<Vec<(u32, String)>> {
    fetch_steamcmd_public_gids_with_retry(appid, 2).await
}

async fn fetch_steamcmd_public_gids_with_retry(appid: u32, retries: u32) -> Result<Vec<(u32, String)>> {
    if appid == 0 {
        return Err("AppId must be greater than zero".into());
    }
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .user_agent("Micah0xC/1.0")
        .build()
        .map_err(|err| err.to_string())?;
    let url = format!("https://api.steamcmd.net/v1/info/{appid}");
    let mut last_err = String::new();
    for attempt in 0..=retries {
        let data: std::result::Result<Value, String> = async {
            let data: Value = client
                .get(&url)
                .send()
                .await
                .map_err(|err| format!("steamcmd.net request failed: {err}"))?
                .json()
                .await
                .map_err(|err| format!("steamcmd.net parse failed: {err}"))?;
            Ok(data)
        }
        .await;
        match data {
            Ok(data) => {
                let depots = data
                    .get("data")
                    .and_then(|d| d.get(&appid.to_string()))
                    .and_then(|a| a.get("depots"))
                    .and_then(Value::as_object)
                    .ok_or_else(|| format!("steamcmd.net has no data for AppID {appid}"))?;
                let mut out = Vec::new();
                for (key, depot) in depots {
                    let Ok(depot_id) = key.parse::<u32>() else {
                        continue;
                    };
                    let Some(gid) = depot
                        .get("manifests")
                        .and_then(|m| m.get("public"))
                        .and_then(|p| p.get("gid"))
                        .and_then(Value::as_str)
                    else {
                        continue;
                    };
                    if gid.is_empty() || !gid.chars().all(|c| c.is_ascii_digit()) {
                        continue;
                    }
                    out.push((depot_id, gid.to_string()));
                }
                if out.is_empty() {
                    return Err(format!(
                        "steamcmd.net lists no public manifests for AppID {appid}"
                    ));
                }
                return Ok(out);
            }
            Err(e) if attempt < retries => {
                last_err = e;
                tokio::time::sleep(Duration::from_millis(400 * (attempt as u64 + 1))).await;
                continue;
            }
            Err(e) => return Err(e),
        }
    }
    Err(last_err)
}

/// Apply fresh gids to one parsed game config.
/// Returns (updates, already_current_count).
fn apply_fresh_gids(
    game: &mut GameConfig,
    gids: &[(u32, String)],
    warnings: &mut Vec<String>,
) -> (Vec<ManifestRefreshEntry>, u32) {
    let mut updated = Vec::new();
    let mut unchanged = 0u32;
    let mut warned: Vec<u32> = Vec::new();
    for entry in &mut game.manifest_entries {
        match gids.iter().find(|(depot, _)| *depot == entry.depot_id) {
            Some((_, new_gid)) if *new_gid != entry.manifest_gid => {
                updated.push(ManifestRefreshEntry {
                    depot_id: entry.depot_id,
                    old_gid: std::mem::replace(&mut entry.manifest_gid, new_gid.clone()),
                    new_gid: new_gid.clone(),
                });
            }
            Some(_) => {
                unchanged += 1;
            }
            None => {
                if !warned.contains(&entry.depot_id) {
                    warned.push(entry.depot_id);
                    warnings.push(format!(
                        "depot {} has no public manifest on steamcmd.net (left as-is)",
                        entry.depot_id
                    ));
                }
            }
        }
    }
    // Legacy single-gid field renders as setManifestid(appid, gid).
    if let Some(old) = game.manifest_gid.clone() {
        if let Some((_, new_gid)) = gids.iter().find(|(depot, _)| *depot == game.appid) {
            if *new_gid != old {
                updated.push(ManifestRefreshEntry {
                    depot_id: game.appid,
                    old_gid: old,
                    new_gid: new_gid.clone(),
                });
                game.manifest_gid = Some(new_gid.clone());
            } else {
                unchanged += 1;
            }
        }
    }
    (updated, unchanged)
}

/// Refresh pinned manifest gids inside already-saved Lua files.
/// Rewrites each changed file via render_game_lua (GOST-META included).
/// Refresh pinned manifest gids inside already-saved Lua files.
/// When `app` is given, streams `refresh-manifests-progress` events
/// (same {appid, phase, done, total, message} shape as fix-lua-progress)
/// so the UI progress modal stays live. Pass None for silent callers
/// (tests, fix_lua which emits its own gids-phase events).
pub async fn refresh_manifest_gids_for_paths(
    app: Option<&tauri::AppHandle>,
    appid: u32,
    paths: &[PathBuf],
) -> Result<ManifestRefreshResult> {
    if appid == 0 {
        return Err("AppId must be greater than zero".into());
    }
    let emit = |phase: &str, done: u32, total: u32, message: String| {
        if let Some(handle) = app {
            use tauri::Emitter;
            handle
                .emit(
                    "refresh-manifests-progress",
                    FixLuaProgress {
                        appid,
                        phase: phase.to_string(),
                        done,
                        total,
                        message,
                    },
                )
                .ok();
        }
    };
    emit("start", 0, paths.len().max(1) as u32, "fetching live GIDs".into());
    let gids = fetch_steamcmd_public_gids(appid).await?;
    let mut result = ManifestRefreshResult {
        appid,
        updated: Vec::new(),
        unchanged: 0,
        files_written: Vec::new(),
        warnings: Vec::new(),
    };
    let total = paths.len().max(1) as u32;
    let mut done = 0u32;
    for path in paths {
        let file_name = path
            .file_name()
            .and_then(OsStr::to_str)
            .unwrap_or("game.lua");
        emit(
            "refresh",
            done,
            total,
            format!("checking {file_name}"),
        );
        let text = match fs::read_to_string(path) {
            Ok(text) => text,
            Err(err) => {
                result.warnings.push(format!(
                    "cannot read {}: {err}",
                    path.display()
                ));
                continue;
            }
        };
        let Some(mut game) = parse_game_lua(file_name, &text) else {
            result.warnings.push(format!(
                "cannot parse AppID from {} (left as-is)",
                path.display()
            ));
            continue;
        };
        let (updated, unchanged) = apply_fresh_gids(&mut game, &gids, &mut result.warnings);
        result.unchanged += unchanged;
        if updated.is_empty() {
            continue;
        }
        let new_text = match render_game_lua(&game) {
            Ok(text) => text,
            Err(err) => {
                result.warnings.push(format!(
                    "cannot re-render {}: {err}",
                    path.display()
                ));
                continue;
            }
        };
        if let Err(err) = fs::write(path, new_text) {
            result.warnings.push(format!(
                "cannot write {}: {err}",
                path.display()
            ));
            continue;
        }
        result.files_written.push(display_path(path));
        for entry in updated {
            if !result.updated.iter().any(|e| e.depot_id == entry.depot_id) {
                emit(
                    "refresh",
                    done,
                    total,
                    format!("depot {}: {} → {}", entry.depot_id, entry.old_gid, entry.new_gid),
                );
                result.updated.push(entry);
            }
        }
        done += 1;
        emit("refresh", done, total, format!("{file_name}: done"));
    }
    emit(
        "done",
        1,
        1,
        format!(
            "finished: {} updated, {} unchanged",
            result.updated.len(),
            result.unchanged
        ),
    );
    Ok(result)
}

/// Refresh pinned manifest gids for every Lua file known for an AppID:
/// the app-data `{appid}_*.lua` script(s) plus Steam's `G-{appid}.lua`.
pub async fn refresh_manifest_gids(
    app: &tauri::AppHandle,
    steam_dir: Option<&str>,
    appid: u32,
) -> Result<ManifestRefreshResult> {
    if appid == 0 {
        return Err("AppId must be greater than zero".into());
    }
    let mut paths: Vec<PathBuf> = Vec::new();
    if let Ok(dir) = lua_scripts_dir(app) {
        if let Ok(entries) = fs::read_dir(&dir) {
            let prefix = format!("{appid}_");
            for entry in entries.flatten() {
                let name = entry.file_name().to_string_lossy().into_owned();
                if name.starts_with(&prefix) && name.ends_with(".lua") {
                    paths.push(entry.path());
                }
            }
        }
    }
    let steam_dir: Option<PathBuf> = match steam_dir {
        Some(dir) if !dir.trim().is_empty() => Some(validate_steam_dir(dir)?),
        _ => detect_steam_dir()?,
    };
    if let Some(steam) = steam_dir {
        let dir = lua_dir(&steam);
        for enabled in [true, false] {
            let path = dir.join(game_file_name(appid, enabled));
            if path.exists() {
                paths.push(path);
            }
        }
    }
    if paths.is_empty() {
        return Err(format!("No Lua files found for AppID {appid}"));
    }
    refresh_manifest_gids_for_paths(Some(app), appid, &paths).await
}

// ==================== MIRROR MANIFEST SEED ====================
//
// Downloads real `.manifest` binaries from community mirrors into
// `<steam>/depotcache/<depot>_<gid>.manifest` and pins the matching GID in
// `G-<appid>.lua`. A cached manifest lets Steam skip the manifest-request-
// code step entirely, which is the only working path for games the account
// does not own (server-side 401 gate — no client bypass exists).
// Mirrors carry no codes/keys, only archived files, so this is pure
// file placement: Lua alone shows the game, manifest alone is inert,
// both in the right folders is what installs.

const HUB3_RAW_TEMPLATE: &str = "https://raw.githubusercontent.com/steamtools-games/ManifestHub3/{appid}/{depot}_{gid}.manifest";

/// Canonical mirror URL for one depot manifest (no auth, no rate limit).
pub fn hub3_raw_url(appid: u32, depot: u32, gid: &str) -> String {
    HUB3_RAW_TEMPLATE
        .replace("{appid}", &appid.to_string())
        .replace("{depot}", &depot.to_string())
        .replace("{gid}", gid)
}

/// GIDs already cached for one depot (`<depot>_*.manifest`, non-empty only).
fn cached_gids_for(depotcache_dir: &std::path::Path, depot: u32) -> Vec<String> {
    let prefix = format!("{depot}_");
    let mut out = Vec::new();
    let entries = match std::fs::read_dir(depotcache_dir) {
        Ok(e) => e,
        Err(_) => return out,
    };
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().into_owned();
        let Some(rest) = name.strip_prefix(&prefix) else {
            continue;
        };
        let Some(gid) = rest.strip_suffix(".manifest") else {
            continue;
        };
        if gid.is_empty() || gid == "0" || !gid.chars().all(|c| c.is_ascii_digit()) {
            continue;
        }
        let non_empty = entry
            .metadata()
            .map(|m| m.len() > 0)
            .unwrap_or(false);
        if non_empty && !out.contains(&gid.to_string()) {
            out.push(gid.to_string());
        }
    }
    out.sort();
    out
}

/// Depots holding a 64-hex key anywhere in the Lua text.
fn keyed_depots_in_lua(text: &str) -> std::collections::HashSet<u32> {
    let mut set = std::collections::HashSet::new();
    for e in find_addappid_entries(text) {
        if e.depot_key.as_deref().map(|k| !k.is_empty()).unwrap_or(false) {
            set.insert(e.appid);
        }
    }
    for (depot, _) in find_set_depot_keys(text) {
        set.insert(depot);
    }
    set
}

/// Replace the pinned GID of one depot's setManifestid line (any case),
/// preserving the rest of the file byte-for-byte. Returns (new_text, changed).
fn patch_lua_gid_text(text: &str, depot: u32, gid: &str) -> (String, bool) {
    const MARKER: &str = "setmanifestid";
    let mut out = String::with_capacity(text.len());
    let mut changed = false;
    for line in text.split_inclusive('\n') {
        let lower = line.to_ascii_lowercase();
        let mut replaced: Option<String> = None;
        if let Some(pos) = lower.find(MARKER) {
            let after = &line[pos + MARKER.len()..];
            if let Some(open) = after.find('(') {
                let num: String = after[open + 1..]
                    .chars()
                    .take_while(|c| c.is_ascii_digit())
                    .collect();
                if num.parse::<u32>().ok() == Some(depot) {
                    // Replace the first quoted all-digit run on this line.
                    if let Some(q1) = line.find('"') {
                        if let Some(q2rel) = line[q1 + 1..].find('"') {
                            let q2 = q1 + 1 + q2rel;
                            let inner = &line[q1 + 1..q2];
                            if !inner.is_empty() && inner.chars().all(|c| c.is_ascii_digit()) {
                                let mut fresh = String::with_capacity(line.len());
                                fresh.push_str(&line[..q1 + 1]);
                                fresh.push_str(gid);
                                fresh.push_str(&line[q2..]);
                                replaced = Some(fresh);
                                changed = true;
                            }
                        }
                    }
                }
            }
        }
        match replaced {
            Some(fresh) => out.push_str(&fresh),
            None => out.push_str(line),
        }
    }
    (out, changed)
}

fn manifest_looks_valid(bytes: &[u8]) -> bool {
    if bytes.len() < 16 {
        return false;
    }
    let magic = bytes[0..4].iter().map(|b| format!("{b:02x}")).collect::<String>();
    magic == "d017f671" || magic == "0a0f08" || bytes.len() > 1024
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SeededDepot {
    pub depot_id: u32,
    pub gid: String,
    pub bytes: u64,
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SeedManifestsResult {
    pub appid: u32,
    pub seeded: Vec<SeededDepot>,
    pub already_cached: Vec<u32>,
    pub missing: Vec<u32>,
    pub no_key: Vec<u32>,
    pub lua_updated: bool,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrepareInstallReport {
    pub appid: u32,
    pub steps: Vec<String>,
    pub ready_to_install: bool,
    pub blockers: Vec<String>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DepotInstallState {
    pub depot_id: u32,
    pub live_gid: String,
    pub lua_gid: String,
    pub cached: bool,
    pub has_key: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstallStatus {
    pub appid: u32,
    pub state: String,
    pub depots: Vec<DepotInstallState>,
}

/// Per-depot verdict shared by install_status/prepare_install.
fn classify_depot(has_key: bool, cached_match: bool, has_any_cache: bool) -> &'static str {
    if !has_key {
        "no_key"
    } else if cached_match {
        "ready"
    } else if has_any_cache {
        "stale"
    } else {
        "missing"
    }
}

fn resolve_steam_dir_opt(steam_dir: Option<&str>) -> Result<std::path::PathBuf> {
    match steam_dir {
        Some(dir) if !dir.trim().is_empty() => validate_steam_dir(dir),
        _ => detect_steam_dir()?
            .ok_or_else(|| "Steam directory not found. Please select it in the app first.".to_string()),
    }
}

fn read_game_lua(steam_dir: &std::path::Path, appid: u32) -> Result<String> {
    let path = lua_dir(steam_dir).join(format!("G-{appid}.lua"));
    std::fs::read_to_string(&path)
        .map_err(|_| format!("G-{appid}.lua not found — import Lua first"))
}

/// Mirror URL map for live depots: bundle first (1 round-trip covers all),
/// then the old manifests endpoint, otherwise direct ManifestHub3 raw URLs
/// (HEAD-checked per depot).
async fn resolve_mirror_urls(
    client: &reqwest::Client,
    appid: u32,
    live: &[(u32, String)],
    node_base_url: Option<&str>,
) -> Vec<(u32, String, String)> {
    // (depot, live_gid, mirror_url)
    if let Some(base) = node_base_url.map(str::trim).filter(|s| !s.is_empty()) {
        // Prefer bundle: lua+depots+mirrors in one call (P2).
        if let Some(bundle) = fetch_bundle(&client, base, appid).await {
            if !bundle.mirrors.is_empty() {
                let mut out = Vec::new();
                for (depot_id, gid) in live {
                    let key = depot_id.to_string();
                    if let Some(entry) = bundle.mirrors.get(&key) {
                        if entry.mirror_ok && !entry.mirror_url.is_empty() {
                            out.push((*depot_id, gid.clone(), entry.mirror_url.clone()));
                        } else {
                            out.push((*depot_id, gid.clone(), String::new()));
                        }
                    } else {
                        out.push((*depot_id, gid.clone(), String::new()));
                    }
                }
                return out;
            }
        }
        let url = format!("{}/api/public/manifests/{}", base.trim_end_matches('/'), appid);
        if let Ok(resp) = client.get(&url).send().await {
            if let Ok(body) = resp.json::<serde_json::Value>().await {
                if let Some(map) = body.get("manifests").and_then(|m| m.as_object()) {
                    let mut out = Vec::new();
                    for (depot_id, gid) in live {
                        let key = depot_id.to_string();
                        let entry = map.get(&key);
                        let ok = entry
                            .and_then(|e| e.get("mirror_ok"))
                            .and_then(|v| v.as_bool())
                            .unwrap_or(false);
                        let murl = entry
                            .and_then(|e| e.get("mirror_url"))
                            .and_then(|v| v.as_str())
                            .map(|s| s.to_string())
                            .unwrap_or_else(|| hub3_raw_url(appid, *depot_id, gid));
                        if ok {
                            out.push((*depot_id, gid.clone(), murl));
                        } else {
                            out.push((*depot_id, gid.clone(), String::new()));
                        }
                    }
                    return out;
                }
            }
        }
    }
    // Fallback: raw URLs, HEAD-checked one by one (cheap, no API limit).
    let mut out = Vec::new();
    for (depot_id, gid) in live {
        let url = hub3_raw_url(appid, *depot_id, gid);
        let ok = client
            .head(&url)
            .send()
            .await
            .map(|r| r.status().is_success())
            .unwrap_or(false);
        out.push((*depot_id, gid.clone(), if ok { url } else { String::new() }));
    }
    out
}

/// Download mirror manifests for every live depot missing from depotcache,
/// then pin seeded GIDs into G-<appid>.lua (with .bak backup).
/// Works for ANY appid; missing pieces are reported, never faked.
pub async fn seed_manifests(
    steam_dir: Option<&str>,
    appid: u32,
    node_base_url: Option<&str>,
) -> Result<SeedManifestsResult> {
    seed_manifests_inner(steam_dir, appid, node_base_url, &|_, _, _, _| {}).await
}

/// Inner seeder with a per-depot progress hook (depot_id, done, total, note).
/// fix_lua forwards these as modal events; other callers pass a no-op.
/// The hook must be Send: Tauri commands run on a multi-thread runtime.
async fn seed_manifests_inner(
    steam_dir: Option<&str>,
    appid: u32,
    node_base_url: Option<&str>,
    on_progress: &(dyn Fn(u32, u32, u32, String) + Send + Sync),
) -> Result<SeedManifestsResult> {
    if appid == 0 {
        return Err("AppId must be greater than zero".into());
    }
    let steam = resolve_steam_dir_opt(steam_dir)?;
    let live = fetch_steamcmd_public_gids(appid)
        .await
        .map_err(|e| format!("live GID lookup failed: {e}"))?;
    let lua_text = read_game_lua(&steam, appid).ok();
    let keyed = lua_text
        .as_deref()
        .map(keyed_depots_in_lua)
        .unwrap_or_default();
    let depotcache = steam.join("depotcache");

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .user_agent("Micah0xC/1.0")
        .build()
        .map_err(|err| err.to_string())?;
    let resolved = resolve_mirror_urls(&client, appid, &live, node_base_url).await;

    let mut result = SeedManifestsResult {
        appid,
        seeded: Vec::new(),
        already_cached: Vec::new(),
        missing: Vec::new(),
        no_key: Vec::new(),
        lua_updated: false,
        warnings: Vec::new(),
    };
    let mut seeded_gids: Vec<(u32, String)> = Vec::new();
    let total_depots = resolved.len() as u32;
    let mut done_depots = 0u32;
    for (depot_id, gid, url) in &resolved {
        if depotcache_has(&steam, *depot_id, gid) {
            result.already_cached.push(*depot_id);
            done_depots += 1;
            on_progress(*depot_id, done_depots, total_depots, "cached".into());
        } else if url.is_empty() {
            result.missing.push(*depot_id);
            done_depots += 1;
            on_progress(*depot_id, done_depots, total_depots, "mirror lacks manifest".into());
        } else {
            on_progress(*depot_id, done_depots, total_depots, "downloading".into());
            let bytes = match client.get(url).send().await {
                Ok(resp) if resp.status().is_success() => match resp.bytes().await {
                    Ok(b) => b.to_vec(),
                    Err(e) => {
                        result.warnings.push(format!("depot {depot_id}: read error {e}"));
                        result.missing.push(*depot_id);
                        done_depots += 1;
                        on_progress(*depot_id, done_depots, total_depots, "read error".into());
                        continue;
                    }
                },
                Ok(resp) => {
                    result.warnings.push(format!("depot {depot_id}: mirror HTTP {}", resp.status()));
                    result.missing.push(*depot_id);
                    done_depots += 1;
                    on_progress(*depot_id, done_depots, total_depots, "mirror error".into());
                    continue;
                }
                Err(e) => {
                    result.warnings.push(format!("depot {depot_id}: download error {e}"));
                    result.missing.push(*depot_id);
                    done_depots += 1;
                    on_progress(*depot_id, done_depots, total_depots, "download error".into());
                    continue;
                }
            };
            if !manifest_looks_valid(&bytes) {
                result.warnings.push(format!(
                    "depot {depot_id}: mirror file failed validation ({} bytes)",
                    bytes.len()
                ));
                result.missing.push(*depot_id);
                done_depots += 1;
                on_progress(*depot_id, done_depots, total_depots, "validation failed".into());
                continue;
            }
            if let Err(e) = std::fs::create_dir_all(&depotcache) {
                return Err(format!("cannot create depotcache: {e}"));
            }
            let dest = depotcache.join(format!("{depot_id}_{gid}.manifest"));
            if let Err(e) = std::fs::write(&dest, &bytes) {
                result.warnings.push(format!("depot {depot_id}: write error {e}"));
                result.missing.push(*depot_id);
                done_depots += 1;
                on_progress(*depot_id, done_depots, total_depots, "write error".into());
                continue;
            }
            let size = bytes.len() as u64;
            result.seeded.push(SeededDepot {
                depot_id: *depot_id,
                gid: gid.clone(),
                bytes: size,
                path: dest.display().to_string(),
            });
            seeded_gids.push((*depot_id, gid.clone()));
            done_depots += 1;
            on_progress(*depot_id, done_depots, total_depots, format!("seeded {size} bytes"));
        }
        if !keyed.contains(depot_id) {
            result.no_key.push(*depot_id);
        }
    }
    // Pin freshly seeded GIDs into the Lua (backup first).
    if !seeded_gids.is_empty() {
        if let Some(text) = lua_text {
            let mut patched = text;
            let mut any = false;
            for (depot_id, gid) in &seeded_gids {
                let (next, changed) = patch_lua_gid_text(&patched, *depot_id, gid);
                patched = next;
                any = any || changed;
            }
            // Add pins for seeded depots lacking any setManifestid line.
            let existing: std::collections::HashSet<u32> = find_manifest_entries(&patched)
                .into_iter()
                .map(|e| e.depot_id)
                .collect();
            let mut extra = String::new();
            for (depot_id, gid) in &seeded_gids {
                if !existing.contains(depot_id) {
                    extra.push_str(&format!("\nsetManifestid({depot_id},\"{gid}\")"));
                    any = true;
                }
            }
            if any {
                let path = lua_dir(&steam).join(format!("G-{appid}.lua"));
                let bak = format!("{}.bak", path.display());
                let _ = std::fs::copy(&path, &bak);
                patched.push_str(&extra);
                if !patched.ends_with('\n') {
                    patched.push('\n');
                }
                match std::fs::write(&path, patched) {
                    Ok(()) => result.lua_updated = true,
                    Err(e) => result.warnings.push(format!("Lua pin update failed: {e}")),
                }
            }
        } else {
            result.warnings.push(format!("G-{appid}.lua not found — import Lua first"));
        }
    }
    result.already_cached.sort_unstable();
    result.missing.sort_unstable();
    result.no_key.sort_unstable();
    Ok(result)
}

/// Headless install readiness: runs seed_manifests, then reports per-depot
/// state for ANY appid. ready_to_install is true only with zero blockers.
pub async fn prepare_install(
    steam_dir: Option<&str>,
    appid: u32,
    node_base_url: Option<&str>,
) -> Result<PrepareInstallReport> {
    if appid == 0 {
        return Err("AppId must be greater than zero".into());
    }
    let mut report = PrepareInstallReport {
        appid,
        steps: Vec::new(),
        ready_to_install: false,
        blockers: Vec::new(),
        warnings: Vec::new(),
    };
    let steam = match resolve_steam_dir_opt(steam_dir) {
        Ok(s) => s,
        Err(e) => {
            report.blockers.push(e);
            return Ok(report);
        }
    };
    if read_game_lua(&steam, appid).is_err() {
        report.blockers.push(format!("G-{appid}.lua not found — import Lua first"));
        report.steps.push("lua: missing".into());
        return Ok(report);
    }
    report.steps.push("lua: present".into());
    match seed_manifests(steam_dir, appid, node_base_url).await {
        Ok(seed) => {
            report.steps.push(format!(
                "seed: {} new, {} cached, {} missing",
                seed.seeded.len(),
                seed.already_cached.len(),
                seed.missing.len()
            ));
            for d in &seed.missing {
                report.blockers.push(format!(
                    "mirror has no manifest for depot {d} (game updated or never archived)"
                ));
            }
            for d in &seed.no_key {
                report.blockers.push(format!("depot {d} has no decryption key in Lua"));
            }
            report.warnings.extend(seed.warnings);
            if seed.lua_updated {
                report.steps.push("lua: pins updated to seeded GIDs".into());
            }
        }
        Err(e) => {
            report.blockers.push(format!("seed failed: {e}"));
            report.steps.push("seed: failed".into());
            return Ok(report);
        }
    }
    let acf = steam
        .join("steamapps")
        .join(format!("appmanifest_{appid}.acf"));
    report.steps.push(if acf.exists() {
        "acf: present".into()
    } else {
        "acf: absent (Steam creates it when install starts)".into()
    });
    report.ready_to_install = report.blockers.is_empty();
    if report.ready_to_install {
        report.steps.push(
            "ready: restart Steam, then install — CDN serves chunks without ownership check once the manifest is cached"
                .into(),
        );
    }
    Ok(report)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstallReadiness {
    pub appid: u32,
    /// True only when Lua exists AND every live depot is cached + keyed.
    pub ready: bool,
    pub lua_present: bool,
    /// install_status state word: READY/PARTIAL/STALE_MANIFEST/...
    pub state: String,
    pub blockers: Vec<String>,
}

/// One call answering "can this game actually install right now?"
/// Combines the Lua check (old check_lua_manifest only asked the Lua API)
/// with local manifest-cache coverage from install_status.
pub async fn check_install_ready(
    steam_dir: Option<&str>,
    appid: u32,
) -> Result<InstallReadiness> {
    if appid == 0 {
        return Err("AppId must be greater than zero".into());
    }
    let steam = resolve_steam_dir_opt(steam_dir)?;
    let lua_present = lua_dir(&steam).join(format!("G-{appid}.lua")).exists();
    let mut blockers = Vec::new();
    if !lua_present {
        blockers.push(format!("G-{appid}.lua not found — import Lua first"));
    }
    let status = install_status(Some(&steam.to_string_lossy()), appid).await;
    let (state, ready) = match status {
        Ok(s) => {
            for d in &s.depots {
                if !d.has_key {
                    blockers.push(format!("depot {} has no decryption key in Lua", d.depot_id));
                } else if !d.cached {
                    let cached_note = if d.lua_gid.is_empty() {
                        " (no GID pinned in Lua)"
                    } else {
                        ""
                    };
                    blockers.push(format!(
                        "no cached manifest for depot {} (live GID {}){}",
                        d.depot_id, d.live_gid, cached_note
                    ));
                }
            }
            let ready = lua_present && s.state == "READY";
            (s.state, ready)
        }
        Err(e) => {
            blockers.push(format!("status check failed: {e}"));
            ("UNKNOWN".to_string(), false)
        }
    };
    Ok(InstallReadiness {
        appid,
        ready,
        lua_present,
        state,
        blockers,
    })
}

/// Live progress event for the Fix Lua modal (`fix-lua-progress`).
/// `phase`: lua → keys → gids → seed → done. `done`/`total` drive the bar;
/// `message` streams into the modal log.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FixLuaProgress {
    pub appid: u32,
    pub phase: String,
    pub done: u32,
    pub total: u32,
    pub message: String,
}

fn emit_fix_progress(
    app: &tauri::AppHandle,
    appid: u32,
    phase: &str,
    done: u32,
    total: u32,
    message: String,
) {
    use tauri::Emitter;
    app.emit(
        "fix-lua-progress",
        FixLuaProgress {
            appid,
            phase: phase.to_string(),
            done,
            total,
            message,
        },
    )
    .ok();
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FixLuaReport {
    pub appid: u32,
    pub steps: Vec<String>,
    pub lua_created: bool,
    pub fixed_keys: Vec<u32>,
    pub refreshed_gids: Vec<u32>,
    pub seeded: Vec<u32>,
    pub missing_manifests: Vec<u32>,
    pub no_key_remaining: Vec<u32>,
    pub warnings: Vec<String>,
}

fn is_hex64(s: &str) -> bool {
    s.len() == 64 && s.chars().all(|c| c.is_ascii_hexdigit())
}

/// Append `addappid(depot,0,"key")` lines for depots lacking keys.
/// Returns (new_text, added_depots). Pure: no I/O, covered by tests.
fn merge_missing_keys_text(text: &str, keys: &[(u32, String)]) -> (String, Vec<u32>) {
    let have = keyed_depots_in_lua(text);
    let mut fresh = text.to_string();
    if !fresh.ends_with('\n') {
        fresh.push('\n');
    }
    let mut added = Vec::new();
    let mut list: Vec<(u32, String)> = keys.to_vec();
    list.sort_by_key(|(depot, _)| *depot);
    for (depot, key) in list {
        if have.contains(&depot) || added.contains(&depot) {
            continue;
        }
        if !is_hex64(&key) {
            continue;
        }
        fresh.push_str(&format!("addappid({depot},0,\"{}\")\n", key.to_lowercase()));
        added.push(depot);
    }
    (fresh, added)
}

fn write_lua_with_backup(path: &std::path::Path, text: &str) -> Result<()> {
    let bak = format!("{}.bak", path.display());
    let _ = std::fs::copy(path, &bak);
    std::fs::write(path, text).map_err(|e| format!("cannot write {}: {e}", path.display()))
}

/// Depot keys from the Node layer (`/api/public/depots/[appid]`).
async fn fetch_node_depot_keys(
    client: &reqwest::Client,
    node_base_url: &str,
    appid: u32,
) -> Vec<(u32, String)> {
    let url = format!(
        "{}/api/public/depots/{}",
        node_base_url.trim_end_matches('/'),
        appid
    );
    let mut out = Vec::new();
    let Ok(resp) = client.get(&url).send().await else {
        return out;
    };
    if !resp.status().is_success() {
        return out;
    }
    let Ok(body) = resp.json::<serde_json::Value>().await else {
        return out;
    };
    let empty = Vec::new();
    let rows = body
        .get("depots")
        .and_then(|v| v.as_array())
        .unwrap_or(&empty);
    for row in rows {
        let depot = row
            .get("depot_id")
            .and_then(|v| v.as_str().and_then(|s| s.parse::<u32>().ok()).or_else(|| v.as_u64().and_then(|n| u32::try_from(n).ok())));
        let key = row
            .get("depot_key")
            .and_then(|v| v.as_str())
            .map(str::trim)
            .unwrap_or_default();
        if let (Some(depot), key) = (depot, key) {
            if is_hex64(key) {
                out.push((depot, key.to_lowercase()));
            }
        }
    }
    out
}

/// Depot keys parsed from a raw Lua text (steamtools.games fallback).
fn fetch_lua_text_keys(text: &str) -> Vec<(u32, String)> {
    find_addappid_entries(text)
        .into_iter()
        .filter_map(|e| {
            e.depot_key
                .filter(|k| is_hex64(k))
                .map(|k| (e.appid, k.to_lowercase()))
        })
        .collect()
}

/// Full Lua file from the Node layer (`/api/Micah/lua/[appid]`, text/plain).
async fn fetch_node_lua_file(
    client: &reqwest::Client,
    node_base_url: &str,
    appid: u32,
) -> Option<String> {
    let url = format!(
        "{}/api/Micah/lua/{}",
        node_base_url.trim_end_matches('/'),
        appid
    );
    let resp = client.get(&url).send().await.ok()?;
    if !resp.status().is_success() {
        return None;
    }
    let text = resp.text().await.ok()?;
    if text.contains("addappid(") {
        Some(text)
    } else {
        None
    }
}

async fn fetch_steamtools_lua_text(client: &reqwest::Client, appid: u32) -> Option<String> {
    let url = format!("https://steamtools.games/api/files/{appid}/lua");
    let resp = client.get(&url).send().await.ok()?;
    if !resp.status().is_success() {
        return None;
    }
    let text = resp.text().await.ok()?;
    if text.contains("addappid(") {
        Some(text)
    } else {
        None
    }
}

/// Single-call bundle: lua + depots + mirrors + token in one Node round-trip.
/// New in P2: fix_lua + seed prefer this when node_base_url is set; every field
/// is optional so a partial bundle still helps, and failure falls back to the
/// old per-endpoint calls. Never throws — None means "bundle unavailable".
#[derive(Debug, Clone, Deserialize)]
struct BundleDepot {
    depot_id: String,
    depot_key: Option<String>,
    manifest: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
struct BundleMirror {
    live_gid: String,
    mirror_url: String,
    mirror_ok: bool,
}

#[derive(Debug, Clone, Deserialize)]
struct BundlePayload {
    appid: String,
    name: String,
    lua: Option<String>,
    token: Option<String>,
    depots: Vec<BundleDepot>,
    mirrors: std::collections::HashMap<String, BundleMirror>,
}

async fn fetch_bundle(
    client: &reqwest::Client,
    node_base_url: &str,
    appid: u32,
) -> Option<BundlePayload> {
    let url = format!(
        "{}/api/Micah/bundle/{}",
        node_base_url.trim_end_matches('/'),
        appid
    );
    let resp = client.get(&url).send().await.ok()?;
    if !resp.status().is_success() {
        return None;
    }
    let body: serde_json::Value = resp.json().await.ok()?;
    // bundle returns {appid, name, lua, token, depots[], mirrors{depot:{live_gid,mirror_url,mirror_ok}}}
    // Depots may be missing when DB empty; mirrors may be empty when live unavailable — still useful.
    let lua = body.get("lua").and_then(|v| v.as_str()).map(|s| s.to_string());
    let depots: Vec<BundleDepot> = body
        .get("depots")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|row| {
                    let depot_id = row.get("depot_id")?.as_str()?.to_string();
                    Some(BundleDepot {
                        depot_id,
                        depot_key: row.get("depot_key").and_then(|v| v.as_str()).map(|s| s.to_string()),
                        manifest: row.get("manifest").and_then(|v| v.as_str()).map(|s| s.to_string()),
                    })
                })
                .collect()
        })
        .unwrap_or_default();
    let mirrors: std::collections::HashMap<String, BundleMirror> = body
        .get("mirrors")
        .and_then(|v| v.as_object())
        .map(|map| {
            map.iter()
                .filter_map(|(k, v)| {
                    Some((
                        k.clone(),
                        BundleMirror {
                            live_gid: v.get("live_gid")?.as_str()?.to_string(),
                            mirror_url: v.get("mirror_url")?.as_str().unwrap_or("").to_string(),
                            mirror_ok: v.get("mirror_ok")?.as_bool().unwrap_or(false),
                        },
                    ))
                })
                .collect()
        })
        .unwrap_or_default();
    Some(BundlePayload {
        appid: body
            .get("appid")
            .and_then(|v| v.as_str())
            .unwrap_or(&appid.to_string())
            .to_string(),
        name: body
            .get("name")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        lua,
        token: body.get("token").and_then(|v| v.as_str()).map(|s| s.to_string()),
        depots,
        mirrors,
    })
}

/// Audit + repair one game's Lua end-to-end, for ANY appid:
///
/// 1. Lua missing? Pull it (Node `/api/Micah/lua` first, steamtools.games
///    fallback) and save as `G-<appid>.lua`.
/// 2. Depots without keys? Merge keys (Node depots endpoint, then
///    steamtools.games Lua). Backup `.bak` before every write.
/// 3. Stale pinned GIDs? Refresh to live steamcmd.net GIDs.
/// 4. Missing manifests? Seed from mirrors (pins seeded GIDs).
///
/// Everything missing that cannot be fixed is reported, never faked.
pub async fn fix_lua(
    app: &tauri::AppHandle,
    steam_dir: Option<&str>,
    appid: u32,
    node_base_url: Option<&str>,
) -> Result<FixLuaReport> {
    if appid == 0 {
        return Err("AppId must be greater than zero".into());
    }
    // Phase totals: lua(1) + keys(1) + gids(1) + seed per-depot + done(1).
    // Live depot count is unknown until the GID lookup, so seed progress
    // re-emits with the real total once known.
    emit_fix_progress(app, appid, "start", 0, 1, "starting Fix Lua".into());
    let mut report = FixLuaReport {
        appid,
        steps: Vec::new(),
        lua_created: false,
        fixed_keys: Vec::new(),
        refreshed_gids: Vec::new(),
        seeded: Vec::new(),
        missing_manifests: Vec::new(),
        no_key_remaining: Vec::new(),
        warnings: Vec::new(),
    };
    let steam = resolve_steam_dir_opt(steam_dir)?;
    let lua_path = lua_dir(&steam).join(format!("G-{appid}.lua"));
    let node = node_base_url.map(str::trim).filter(|s| !s.is_empty());

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .user_agent("Micah0xC/1.0")
        .build()
        .map_err(|err| err.to_string())?;

    // --- 1. Lua file -------------------------------------------------
    emit_fix_progress(app, appid, "lua", 0, 4, "checking Lua file".into());
    // Opportunistically fetch bundle once when Node is configured — it carries
    // lua/depots/mirrors together, so later phases can avoid extra round-trips.
    let bundle = if let Some(base) = node {
        fetch_bundle(&client, base, appid).await
    } else {
        None
    };
    if !lua_path.exists() {
        report.steps.push("lua: missing".into());
        let mut pulled: Option<String> = bundle.as_ref().and_then(|b| b.lua.clone());
        if pulled.is_some() {
            report.steps.push("lua: pulled from bundle".into());
        }
        if pulled.is_none() {
            if let Some(base) = node {
                pulled = fetch_node_lua_file(&client, base, appid).await;
                if pulled.is_some() {
                    report.steps.push("lua: pulled from Node layer".into());
                }
            }
        }
        if pulled.is_none() {
            pulled = fetch_steamtools_lua_text(&client, appid).await;
            if pulled.is_some() {
                report.steps.push("lua: pulled from steamtools.games".into());
            }
        }
        match pulled {
            Some(text) => {
                if let Some(parent) = lua_path.parent() {
                    let _ = std::fs::create_dir_all(parent);
                }
                std::fs::write(&lua_path, text)
                    .map_err(|e| format!("cannot write {}: {e}", lua_path.display()))?;
                report.lua_created = true;
                report.steps.push("lua: created".into());
            }
            None => {
                report.warnings.push(format!(
                    "G-{appid}.lua not found and no source has it — import Lua first"
                ));
                emit_fix_progress(app, appid, "done", 1, 1, "nothing to fix (no Lua)".into());
                return Ok(report);
            }
        }
    } else {
        report.steps.push("lua: present".into());
    }
    emit_fix_progress(app, appid, "lua", 1, 4, "Lua file OK".into());
    let read_lua = || std::fs::read_to_string(&lua_path).unwrap_or_default();

    // --- 2. Missing keys ---------------------------------------------
    emit_fix_progress(app, appid, "keys", 1, 4, "fetching live GIDs".into());
    let live = fetch_steamcmd_public_gids(appid)
        .await
        .map_err(|e| format!("live GID lookup failed: {e}"))?;
    let mut text = read_lua();
    let mut keyed = keyed_depots_in_lua(&text);
    let missing_keys: Vec<u32> = live
        .iter()
        .map(|(depot, _)| *depot)
        .filter(|depot| !keyed.contains(depot))
        .collect();
    if !missing_keys.is_empty() {
        report.steps.push(format!("keys: {} missing", missing_keys.len()));
        let mut candidates: Vec<(u32, String)> = Vec::new();
        if let Some(b) = bundle.as_ref() {
            for dep in &b.depots {
                if let (Ok(depot), Some(key)) = (
                    dep.depot_id.parse::<u32>(),
                    dep.depot_key.as_deref(),
                ) {
                    if is_hex64(key) {
                        candidates.push((depot, key.to_lowercase()));
                    }
                }
            }
            if !candidates.is_empty() {
                report.steps.push("keys: from bundle".into());
            }
        }
        if candidates.len() < missing_keys.len() {
            if let Some(base) = node {
                candidates.extend(fetch_node_depot_keys(&client, base, appid).await);
            }
        }
        // Fallback covers Node gaps (DB key-less apps).
        if candidates.len() < missing_keys.len() {
            if let Some(lua_text) = fetch_steamtools_lua_text(&client, appid).await {
                candidates.extend(fetch_lua_text_keys(&lua_text));
            }
        }
        let wanted: Vec<(u32, String)> = candidates
            .into_iter()
            .filter(|(depot, _)| missing_keys.contains(depot))
            .collect();
        let (next, added) = merge_missing_keys_text(&text, &wanted);
        if !added.is_empty() {
            write_lua_with_backup(&lua_path, &next)?;
            report.fixed_keys.extend(&added);
            report.steps.push(format!("keys: fixed {}", added.len()));
            text = next;
            keyed = keyed_depots_in_lua(&text);
        }
        for depot in &missing_keys {
            if !keyed.contains(depot) {
                report.no_key_remaining.push(*depot);
            }
        }
        if !report.no_key_remaining.is_empty() {
            report.warnings.push(format!(
                "no source has keys for depot(s) {:?} — encrypted content stays locked",
                report.no_key_remaining
            ));
        }
    } else {
        report.steps.push("keys: complete".into());
    }
    emit_fix_progress(
        app,
        appid,
        "keys",
        2,
        4,
        format!("keys checked ({} fixed)", report.fixed_keys.len()),
    );

    // --- 3. Stale GIDs ------------------------------------------------
    emit_fix_progress(app, appid, "gids", 2, 4, "refreshing pinned GIDs".into());
    match refresh_manifest_gids_for_paths(None, appid, &[lua_path.clone()]).await {
        Ok(refresh) => {
            for entry in refresh.updated {
                if !report.refreshed_gids.contains(&entry.depot_id) {
                    report.refreshed_gids.push(entry.depot_id);
                }
            }
            report.warnings.extend(refresh.warnings);
            report.steps.push(format!("gids: {} refreshed", report.refreshed_gids.len()));
        }
        Err(e) => {
            report.warnings.push(format!("gid refresh skipped: {e}"));
            report.steps.push("gids: skipped".into());
        }
    }

    // --- 4. Seed manifests --------------------------------------------
    emit_fix_progress(
        app,
        appid,
        "gids",
        3,
        4,
        format!("GIDs refreshed ({})", report.refreshed_gids.len()),
    );
    let steam_str = steam.to_string_lossy().into_owned();
    let seed_total = live.len() as u32;
    let seed_progress = |depot_id: u32, done: u32, total: u32, note: String| {
        // Map per-depot seed progress into the overall bar (phase "seed").
        let _ = total;
        emit_fix_progress(
            app,
            appid,
            "seed",
            3 + done.min(seed_total),
            3 + seed_total + 1,
            format!("depot {depot_id}: {note}"),
        );
    };
    match seed_manifests_inner(Some(&steam_str), appid, node, &seed_progress).await {
        Ok(seed) => {
            report.seeded = seed.seeded.iter().map(|s| s.depot_id).collect();
            report.missing_manifests = seed.missing.clone();
            for d in &seed.no_key {
                if !report.no_key_remaining.contains(d) {
                    report.no_key_remaining.push(*d);
                }
            }
            report.warnings.extend(seed.warnings);
            report.steps.push(format!(
                "seed: {} new, {} cached, {} missing",
                seed.seeded.len(),
                seed.already_cached.len(),
                seed.missing.len()
            ));
            if seed.lua_updated {
                report.steps.push("lua: pins updated to seeded GIDs".into());
            }
        }
        Err(e) => {
            report.warnings.push(format!("seed skipped: {e}"));
            report.steps.push("seed: skipped".into());
        }
    }
    report.no_key_remaining.sort_unstable();
    report.missing_manifests.sort_unstable();
    emit_fix_progress(
        app,
        appid,
        "done",
        1,
        1,
        format!(
            "finished: {} seeded, {} missing manifests, {} keyless",
            report.seeded.len(),
            report.missing_manifests.len(),
            report.no_key_remaining.len()
        ),
    );
    Ok(report)
}

/// Read-only per-depot install state for ANY appid (no downloads, no writes).
pub async fn install_status(
    steam_dir: Option<&str>,
    appid: u32,
) -> Result<InstallStatus> {
    if appid == 0 {
        return Err("AppId must be greater than zero".into());
    }
    let steam = resolve_steam_dir_opt(steam_dir)?;
    let live = fetch_steamcmd_public_gids(appid)
        .await
        .map_err(|e| format!("live GID lookup failed: {e}"))?;
    let lua_text = read_game_lua(&steam, appid).unwrap_or_default();
    let keyed = keyed_depots_in_lua(&lua_text);
    let lua_pins: std::collections::HashMap<u32, String> = find_manifest_entries(&lua_text)
        .into_iter()
        .map(|e| (e.depot_id, e.manifest_gid))
        .collect();
    let depotcache = steam.join("depotcache");
    let mut depots = Vec::new();
    let mut counts = std::collections::HashMap::from([
        ("ready", 0u32),
        ("missing", 0u32),
        ("stale", 0u32),
        ("no_key", 0u32),
    ]);
    for (depot_id, live_gid) in &live {
        let has_key = keyed.contains(depot_id);
        let cached = cached_gids_for(&depotcache, *depot_id);
        let hit = cached.iter().any(|g| g == live_gid);
        let verdict = classify_depot(has_key, hit, !cached.is_empty());
        *counts.get_mut(verdict).unwrap_or(&mut 0) += 1;
        depots.push(DepotInstallState {
            depot_id: *depot_id,
            live_gid: live_gid.clone(),
            lua_gid: lua_pins.get(depot_id).cloned().unwrap_or_default(),
            cached: hit,
            has_key,
        });
    }
    depots.sort_by_key(|d| d.depot_id);
    let state = if depots.is_empty() {
        "NO_LIVE".to_string()
    } else if counts["no_key"] > 0 && counts["ready"] == 0 && counts["missing"] == 0 && counts["stale"] == 0 {
        "NO_KEY".to_string()
    } else if counts["missing"] == 0 && counts["stale"] == 0 && counts["no_key"] == 0 {
        "READY".to_string()
    } else if counts["missing"] > 0 && counts["ready"] == 0 && counts["stale"] == 0 {
        "MISSING_MANIFEST".to_string()
    } else if counts["stale"] > 0 && counts["ready"] == 0 && counts["missing"] == 0 {
        "STALE_MANIFEST".to_string()
    } else {
        "PARTIAL".to_string()
    };
    Ok(InstallStatus { appid, state, depots })
}

/// ── pasted manifest-code overrides ─────────────────────────────────────
///
/// Community-shared manifest request codes die in ~5 minutes, so the only
/// workable flow is: paste fresh `depot: code` lines → download IMMEDIATELY.
/// The DLL reads <steam>/micah_mode/manifest_code_overrides.json on every
/// fetch (30 s cache) and prefers these over every provider.

const MANIFEST_CODE_OVERRIDES_FILE: &str = "manifest_code_overrides.json";

fn manifest_overrides_path(steam_dir: Option<&str>) -> Result<PathBuf> {
    let steam: PathBuf = match steam_dir {
        Some(dir) if !dir.trim().is_empty() => validate_steam_dir(dir)?,
        _ => detect_steam_dir()?
            .ok_or_else(|| "Steam directory not found. Please select it in the app first.".to_string())?,
    };
    Ok(steam.join("micah_mode"))
}

/// Parse pasted manifest codes. Accepts one pair per line in any of these
/// shapes: `3548581: 16782820641112046662`, `3548581 1678…`, `3548581=1678…`.
/// Blank lines, `#`/`//` comments and garbage lines are skipped. The code is
/// the longest numeric token (codes are 16–20 digits, depots ≤ 10 digits).
pub fn parse_manifest_code_overrides(text: &str) -> Vec<(u32, String)> {
    let mut out: Vec<(u32, String)> = Vec::new();
    for raw_line in text.lines() {
        let line = raw_line
            .trim()
            .trim_start_matches(['-', '*'])
            .trim();
        if line.is_empty() || line.starts_with('#') || line.starts_with("//") {
            continue;
        }
        let tokens: Vec<&str> = line
            .split(|c: char| !c.is_ascii_digit())
            .filter(|s| !s.is_empty())
            .collect();
        if tokens.len() < 2 {
            continue;
        }
        // Normal shape `depot: code` — depot ids fit in u32 (≤ 10 digits)
        // while codes run 16–20 digits. Reversed shapes fall back to
        // longest-token heuristics below.
        let mut depot_tok: Option<&str> = None;
        let mut code: &str = "";
        if tokens[0].len() <= 10 {
            depot_tok = Some(tokens[0]);
            for t in &tokens[1..] {
                if t.len() > code.len() {
                    code = *t;
                }
            }
            if code.is_empty() {
                continue;
            }
        } else {
            for t in &tokens {
                if t.len() > code.len() {
                    code = *t;
                }
            }
            for t in &tokens {
                if t.len() <= 10 && *t != code {
                    depot_tok = Some(*t);
                    break;
                }
            }
            if depot_tok.is_none() {
                for t in &tokens {
                    if *t != code {
                        depot_tok = Some(*t);
                        break;
                    }
                }
            }
        }
        let Some(depot_tok) = depot_tok else {
            continue;
        };
        let (Ok(depot_id), Ok(code_num)) =
            (depot_tok.parse::<u32>(), code.parse::<u64>())
        else {
            continue;
        };
        if code_num == 0 {
            continue;
        }
        if let Some(slot) = out.iter_mut().find(|(d, _)| *d == depot_id) {
            slot.1 = code.to_string();
        } else {
            out.push((depot_id, code.to_string()));
        }
    }
    out
}

/// Merge pasted pairs into manifest_code_overrides.json. Returns merged count.
pub fn save_manifest_code_overrides(
    steam_dir: Option<&str>,
    text: &str,
) -> Result<usize> {
    let pairs = parse_manifest_code_overrides(text);
    if pairs.is_empty() {
        return Err("No valid `depot: code` lines found. Example: 3548581: 16782820641112046662".into());
    }
    let dir = manifest_overrides_path(steam_dir)?;
    fs::create_dir_all(&dir).map_err(|err| err.to_string())?;
    let path = dir.join(MANIFEST_CODE_OVERRIDES_FILE);
    let mut map: BTreeMap<u32, String> = fs::read_to_string(&path)
        .ok()
        .and_then(|text| serde_json::from_str(&text).ok())
        .unwrap_or_default();
    for (depot, code) in &pairs {
        map.insert(*depot, code.clone());
    }
    let text =
        serde_json::to_string_pretty(&map).map_err(|err| err.to_string())?;
    fs::write(&path, text).map_err(|err| err.to_string())?;
    Ok(pairs.len())
}

/// Current overrides file content (pretty JSON, `"{}"` when absent).
pub fn read_manifest_code_overrides(steam_dir: Option<&str>) -> Result<String> {
    let path = manifest_overrides_path(steam_dir)?.join(MANIFEST_CODE_OVERRIDES_FILE);
    match fs::read_to_string(&path) {
        Ok(text) if !text.trim().is_empty() => Ok(text),
        _ => Ok("{}".to_string()),
    }
}

/// Delete the overrides file (stops using pasted codes).
pub fn clear_manifest_code_overrides(steam_dir: Option<&str>) -> Result<()> {
    let path = manifest_overrides_path(steam_dir)?.join(MANIFEST_CODE_OVERRIDES_FILE);
    match fs::remove_file(&path) {
        Ok(()) => Ok(()),
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(err) => Err(err.to_string()),
    }
}

/// Fetch app names from SteamSpy with concurrent requests.
///
/// Uses a semaphore to limit concurrency to 3 simultaneous requests, with a
/// 200ms delay between dispatches to respect SteamSpy's ~1 req/sec limit.
/// The name cache (30-day TTL + stale fallback) means most loads skip this.
async fn fetch_store_names(appids: &[u32]) -> Result<BTreeMap<u32, String>> {
    if appids.is_empty() {
        return Ok(BTreeMap::new());
    }
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        .build()
        .map_err(|err| err.to_string())?;

    let semaphore = std::sync::Arc::new(tokio::sync::Semaphore::new(3));
    let mut handles = Vec::with_capacity(appids.len());

    for (i, &appid) in appids.iter().enumerate() {
        // Small delay between dispatches to spread requests over time
        if i > 0 {
            tokio::time::sleep(Duration::from_millis(200)).await;
        }
        let permit = semaphore.clone().acquire_owned().await.map_err(|e| e.to_string())?;
        let client = client.clone();
        handles.push(tokio::task::spawn(async move {
            let _permit = permit; // held until task completes
            let result = fetch_single_name(&client, appid).await;
            (appid, result)
        }));
    }

    let mut out = BTreeMap::new();
    for handle in handles {
        if let Ok((appid, Ok(name))) = handle.await {
            out.insert(appid, name);
        }
    }
    Ok(out)
}

async fn fetch_single_name(client: &reqwest::Client, appid: u32) -> Result<String> {
    let url = format!(
        "https://steamspy.com/api.php?request=appdetails&appid={appid}"
    );
    let response = match client.get(&url).timeout(STORE_FETCH_TIMEOUT).send().await {
        Ok(r) => r,
        Err(err) => {
            eprintln!("[name-hydration] appid {appid}: request failed: {err}");
            return Err(err.to_string().into());
        }
    };
    // Retry once on rate limit
    let response = if response.status() == 429 || response.status() == 503 {
        tokio::time::sleep(Duration::from_secs(3)).await;
        match client.get(&url).timeout(STORE_FETCH_TIMEOUT).send().await {
            Ok(r) => r,
            Err(err) => {
                eprintln!("[name-hydration] appid {appid}: retry failed: {err}");
                return Err(err.to_string().into());
            }
        }
    } else {
        response
    };
    if !response.status().is_success() {
        eprintln!("[name-hydration] appid {appid}: HTTP {}", response.status());
        return Err(format!("HTTP {}", response.status()).into());
    }
    let value: Value = match response.json().await {
        Ok(v) => v,
        Err(err) => {
            eprintln!("[name-hydration] appid {appid}: parse failed: {err}");
            return Err(err.to_string().into());
        }
    };
    let name = value
        .get("name")
        .and_then(Value::as_str)
        .unwrap_or("")
        .trim()
        .to_string();
    if name.is_empty() {
        eprintln!("[name-hydration] appid {appid}: empty name in response");
        return Err("empty name".into());
    }
    Ok(name)
}

/// Resolve real game names for the given appids: serve from the local name
/// cache first, fetch whatever is missing from the Steam Store (one request
/// per appid), and persist results to the cache. Used by the frontend to
/// hydrate placeholder names ("App {appid}") stored in cloud snapshots.
pub async fn resolve_app_names(
    app: &tauri::AppHandle,
    appids: &[u32],
) -> Result<BTreeMap<u32, String>> {
    let cache_path = name_cache_path(app)?;
    let now = system_time_secs(SystemTime::now()).unwrap_or(0);
    let mut cache = load_name_cache(&cache_path);
    let mut out = BTreeMap::new();
    let mut pending = Vec::new();
    for &appid in appids {
        if appid == 0 {
            continue;
        }
        if let Some(name) = fresh_cached_name(&cache, appid, now) {
            out.insert(appid, name);
        } else {
            pending.push(appid);
        }
    }
    if !pending.is_empty() {
        if let Ok(names) = fetch_store_names(&pending).await {
            let mut updated = false;
            for (appid, name) in names {
                out.insert(appid, name.clone());
                cache.insert(
                    appid,
                    NameCacheEntry {
                        name,
                        fetched_at: now,
                    },
                );
                updated = true;
            }
            if updated {
                save_name_cache(&cache_path, &cache);
            }
        }
    }
    Ok(out)
}

#[derive(Debug, Deserialize)]
struct GithubReleaseApiInfo {
    tag_name: String,
    name: Option<String>,
    published_at: Option<String>,
    body: Option<String>,
    html_url: String,
    prerelease: bool,
    assets: Vec<GithubReleaseApiAsset>,
}

#[derive(Debug, Deserialize)]
struct GithubReleaseApiAsset {
    name: String,
    browser_download_url: String,
}

pub async fn check_github_release(dot_enabled: bool) -> Result<GitHubReleaseInfo> {
    let client = reqwest::Client::builder()
        .user_agent("reqwest-gost-app")
        .build()
        .map_err(|e| e.to_string())?;
        
    let url = "https://api.github.com/repos/0xcRachel/Micah_0xC/releases/latest";
    let resp: GithubReleaseApiInfo = client.get(url)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;
        
    Ok(GitHubReleaseInfo {
        version: resp.tag_name,
        name: resp.name.unwrap_or_default(),
        published_at: resp.published_at,
        body: resp.body.unwrap_or_default(),
        html_url: resp.html_url,
        assets: resp.assets.into_iter().map(|a| GitHubReleaseAsset {
            name: a.name,
            browser_download_url: a.browser_download_url,
        }).collect(),
        prerelease: resp.prerelease,
        dns_optimized: dot_enabled,
        resolved_hosts: Vec::new(),
    })
}

pub async fn check_github_beta_release(dot_enabled: bool) -> Result<GitHubReleaseInfo> {
    let client = reqwest::Client::builder()
        .user_agent("reqwest-gost-app")
        .build()
        .map_err(|e| e.to_string())?;
        
    let url = "https://api.github.com/repos/0xcRachel/Micah_0xC/releases";
    let resp: Vec<GithubReleaseApiInfo> = client.get(url)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;
        
    let beta = resp.into_iter()
        .find(|r| r.prerelease)
        .ok_or_else(|| "No beta pre-releases found".to_string())?;
        
    Ok(GitHubReleaseInfo {
        version: beta.tag_name,
        name: beta.name.unwrap_or_default(),
        published_at: beta.published_at,
        body: beta.body.unwrap_or_default(),
        html_url: beta.html_url,
        assets: beta.assets.into_iter().map(|a| GitHubReleaseAsset {
            name: a.name,
            browser_download_url: a.browser_download_url,
        }).collect(),
        prerelease: beta.prerelease,
        dns_optimized: dot_enabled,
        resolved_hosts: Vec::new(),
    })
}

pub fn release_asset_url(release: &GitHubReleaseInfo, name: &str) -> Option<String> {
    release.assets.iter()
        .find(|a| a.name == name)
        .map(|a| a.browser_download_url.clone())
}

pub async fn resolve_github_domain_with_dot(host: &str) -> Result<Vec<String>> {
    let client = reqwest::Client::new();
    let url = format!("https://cloudflare-dns.com/dns-query?name={host}&type=A");
    let resp: serde_json::Value = client.get(&url)
        .header("accept", "application/dns-json")
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;
    
    let mut ips = Vec::new();
    if let Some(answers) = resp.get("Answer").and_then(|a| a.as_array()) {
        for answer in answers {
            if let Some(data) = answer.get("data").and_then(|d| d.as_str()) {
                ips.push(data.to_string());
            }
        }
    }
    
    if ips.is_empty() {
        if let Ok(addrs) = tokio::net::lookup_host(format!("{host}:443")).await {
            for addr in addrs {
                ips.push(addr.ip().to_string());
            }
        }
    }
    
    Ok(ips)
}

pub async fn test_github_dns_latency(host: &str) -> Result<DnsLatencyReport> {
    let providers = vec![
        DnsProviderSpec {
            provider: "Cloudflare",
            address: "1.1.1.1",
            server_name: "cloudflare-dns.com",
            path: "/dns-query",
        },
        DnsProviderSpec {
            provider: "Google",
            address: "8.8.8.8",
            server_name: "dns.google",
            path: "/resolve",
        },
    ];

    let mut results = Vec::new();
    for spec in providers {
        let start = Instant::now();
        let client = reqwest::Client::builder()
            .timeout(Duration::from_millis(1500))
            .build()
            .unwrap();
            
        let url = format!("https://{}/dns-query?name={}&type=A", spec.address, host);
        let ok = client.get(&url)
            .header("accept", "application/dns-json")
            .send()
            .await
            .is_ok();
            
        let latency = if ok { Some(start.elapsed().as_millis() as u64) } else { None };
        results.push(DnsLatencyResult {
            provider: spec.provider.to_string(),
            address: spec.address.to_string(),
            latency_ms: latency,
            ok,
            error: if ok { None } else { Some("Timeout/Network error".to_string()) },
        });
    }

    Ok(DnsLatencyReport {
        host: host.to_string(),
        results,
    })
}

 // ==================== INSTALL HEALTH (ghost detector) ====================
//
// Steam marks a game "installed" (StateFlags & 4) in steamapps/appmanifest_*.acf
// as soon as a download *starts*. When the manifest fetch 401s (no request code
// for unowned games) zero bytes ever land, but the flag + appinfo size stay
// behind: the library shows "Installed, X GB" for an unplayable ghost.

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GameHealth {
    pub appid: u32,
    pub name: String,
    pub state_flags: u32,
    pub install_dir: String,
    pub dir_exists: bool,
    pub bytes_on_disk: u64,
    pub file_count: u64,
    pub has_exe: bool,
    pub acf_size_on_disk: u64,
    pub build_id: String,
    pub lua_managed: bool,
    pub health: String,
    pub can_auto_clean: bool,
    pub ownership_denied: bool,
    pub manifest_401s: u32,
    pub manifests_cached: u32,
    pub manifests_total: u32,
}

/// (depot_id, gid) pairs from the game's Lua manifest entries.
fn lua_manifest_pairs(steam_dir: &Path, appid: u32) -> Vec<(u32, String)> {
    let path = lua_dir(steam_dir).join(format!("G-{appid}.lua"));
    let text = fs::read_to_string(&path).unwrap_or_default();
    find_manifest_entries(&text)
        .into_iter()
        .map(|e| (e.depot_id, e.manifest_gid))
        .collect()
}

/// True when `<steam>/depotcache/<depot>_<gid>.manifest` exists non-empty.
/// A cached manifest lets Steam skip the manifest-request-code step.
fn depotcache_has(steam_dir: &Path, depot: u32, gid: &str) -> bool {
    if gid.is_empty() || gid == "0" {
        return false;
    }
    let p = steam_dir
        .join("depotcache")
        .join(format!("{depot}_{gid}.manifest"));
    std::fs::metadata(&p).map(|m| m.len() > 0).unwrap_or(false)
}

/// Value of the first `"key" "value"` line. Single-token lines (`"InstalledDepots"`)
/// and braces are skipped; nested blocks reuse the syntax but the keys we read
/// only exist at top level.
fn acf_value(text: &str, key: &str) -> Option<String> {
    for raw in text.lines() {
        let line = raw.trim();
        let rest = match line.strip_prefix('"') {
            Some(r) => r,
            None => continue,
        };
        let end = match rest.find('"') {
            Some(i) => i,
            None => continue,
        };
        if &rest[..end] != key {
            continue;
        }
        let rest = rest[end + 1..].trim_start();
        let rest = match rest.strip_prefix('"') {
            Some(r) => r,
            None => continue,
        };
        let end = match rest.find('"') {
            Some(i) => i,
            None => continue,
        };
        return Some(rest[..end].to_string());
    }
    None
}

/// (bytes, file count, has .exe within 3 levels). Depth/file caps are defensive.
fn dir_usage(dir: &Path) -> (u64, u64, bool) {
    let mut bytes = 0u64;
    let mut files = 0u64;
    let mut has_exe = false;
    let mut stack = vec![(dir.to_path_buf(), 0u32)];
    while let Some((d, depth)) = stack.pop() {
        let entries = match fs::read_dir(&d) {
            Ok(e) => e,
            Err(_) => continue,
        };
        for entry in entries.flatten() {
            let meta = match entry.metadata() {
                Ok(m) => m,
                Err(_) => continue,
            };
            if meta.is_dir() {
                if depth < 8 {
                    stack.push((entry.path(), depth + 1));
                }
            } else if meta.is_file() {
                bytes = bytes.saturating_add(meta.len());
                files = files.saturating_add(1);
                if !has_exe
                    && depth <= 3
                    && entry
                        .path()
                        .extension()
                        .and_then(|e| e.to_str())
                        .map(|e| e.eq_ignore_ascii_case("exe"))
                        .unwrap_or(false)
                {
                    has_exe = true;
                }
                if files > 500_000 {
                    return (bytes, files, has_exe);
                }
            }
        }
    }
    (bytes, files, has_exe)
}

fn load_content_log_tail(steam_dir: &Path) -> String {
    fs::read_to_string(steam_dir.join("logs").join("content_log.txt")).unwrap_or_default()
}

fn ownership_denied_in(log: &str, appid: u32) -> bool {
    log.contains(&format!(
        "AppID {appid} failed to update ownership ticket (Access Denied)"
    ))
}

fn line_refs_depot(line: &str, depot: u32) -> bool {
    if line.contains(&format!("depot/{depot}/manifest")) {
        return true;
    }
    let needle = format!("for depot {depot}");
    match line.find(&needle) {
        Some(i) => {
            let after = &line[i + needle.len()..];
            !after
                .chars()
                .next()
                .map(|c| c.is_ascii_digit())
                .unwrap_or(false)
        }
        None => false,
    }
}

fn count_manifest_401s(log: &str, depot_ids: &[u32]) -> u32 {
    if depot_ids.is_empty() {
        return 0;
    }
    let mut n = 0u32;
    for line in log.lines() {
        if !line.contains("401") {
            continue;
        }
        if depot_ids.iter().any(|d| line_refs_depot(line, *d)) {
            n = n.saturating_add(1);
        }
    }
    n
}

fn lua_manifest_depots(steam_dir: &Path, appid: u32) -> Vec<u32> {
    let path = lua_dir(steam_dir).join(format!("G-{appid}.lua"));
    let text = fs::read_to_string(&path).unwrap_or_default();
    find_manifest_entries(&text)
        .into_iter()
        .map(|e| e.depot_id)
        .collect()
}

fn classify_health(
    installed: bool,
    dir_exists: bool,
    bytes: u64,
    has_exe: bool,
    lua_managed: bool,
) -> (&'static str, bool) {
    if !installed {
        return ("not_installed", false);
    }
    if !dir_exists {
        return (
            if lua_managed {
                "ghost_missing"
            } else {
                "unmanaged_ghost"
            },
            lua_managed,
        );
    }
    if bytes == 0 {
        return (
            if lua_managed {
                "ghost_empty"
            } else {
                "unmanaged_empty"
            },
            lua_managed,
        );
    }
    if !has_exe {
        return ("partial", false);
    }
    ("healthy", false)
}

pub fn scan_install_health<P: AsRef<Path>>(steam_dir: P) -> Result<Vec<GameHealth>> {
    let steam_dir = validate_steam_dir(&steam_dir)?;
    let steamapps = steam_dir.join("steamapps");
    let lua = lua_dir(&steam_dir);
    let clog = load_content_log_tail(&steam_dir);
    let mut acfs: Vec<PathBuf> = fs::read_dir(&steamapps)
        .map_err(|e| format!("cannot list steamapps: {e}"))?
        .flatten()
        .map(|e| e.path())
        .filter(|p| {
            p.file_name()
                .and_then(|n| n.to_str())
                .map(|n| n.starts_with("appmanifest_") && n.ends_with(".acf"))
                .unwrap_or(false)
        })
        .collect();
    acfs.sort();
    let mut out = Vec::with_capacity(acfs.len());
    for acf in &acfs {
        let text =
            fs::read_to_string(acf).map_err(|e| format!("cannot read {}: {e}", acf.display()))?;
        let appid: u32 = match acf_value(&text, "appid").and_then(|s| s.parse().ok()) {
            Some(id) => id,
            None => continue,
        };
        let install_sub = acf_value(&text, "installdir").unwrap_or_default();
        let dir = steamapps.join("common").join(&install_sub);
        let dir_exists = dir.is_dir();
        let (bytes, files, has_exe) = if dir_exists {
            dir_usage(&dir)
        } else {
            (0, 0, false)
        };
        let flags: u32 = acf_value(&text, "StateFlags")
            .and_then(|s| s.parse().ok())
            .unwrap_or(0);
        let installed = flags & 4 != 0;
        let lua_managed = lua.join(format!("G-{appid}.lua")).exists();
        let depots = if lua_managed {
            lua_manifest_depots(&steam_dir, appid)
        } else {
            Vec::new()
        };
        let ownership_denied = ownership_denied_in(&clog, appid);
        let manifest_401s = count_manifest_401s(&clog, &depots);
        let pairs = if lua_managed {
            lua_manifest_pairs(&steam_dir, appid)
        } else {
            Vec::new()
        };
        let manifests_total = pairs.len() as u32;
        let manifests_cached = pairs
            .iter()
            .filter(|(depot, gid)| depotcache_has(&steam_dir, *depot, gid))
            .count() as u32;
        let (mut health, mut can_auto_clean) =
            classify_health(installed, dir_exists, bytes, has_exe, lua_managed);
        if health == "not_installed" && lua_managed && dir_exists && bytes == 0 {
            // Steam already dropped the installed flag, but an empty folder
            // was left behind (failed Install click). Safe to remove.
            health = "leftover_empty";
            can_auto_clean = true;
        }
        out.push(GameHealth {
            appid,
            name: acf_value(&text, "name").unwrap_or_else(|| format!("App {appid}")),
            state_flags: flags,
            install_dir: install_sub,
            dir_exists,
            bytes_on_disk: bytes,
            file_count: files,
            has_exe,
            acf_size_on_disk: acf_value(&text, "SizeOnDisk")
                .and_then(|s| s.parse().ok())
                .unwrap_or(0),
            build_id: acf_value(&text, "buildid").unwrap_or_default(),
            lua_managed,
            health: health.to_string(),
            can_auto_clean,
            ownership_denied,
            manifest_401s,
            manifests_cached,
            manifests_total,
        });
    }
    Ok(out)
}

/// Clean one ghost: backup the acf, remove the empty dir + the installed flag.
/// Only ghosts (installed flag, zero bytes) are accepted; unmanaged appids
/// additionally require `force`. Never touches dirs that still hold bytes.
pub fn clean_ghost<P: AsRef<Path>>(steam_dir: P, appid: u32, force: bool) -> Result<String> {
    let steam_dir = validate_steam_dir(&steam_dir)?;
    let found = scan_install_health(&steam_dir)?
        .into_iter()
        .find(|g| g.appid == appid)
        .ok_or_else(|| format!("no appmanifest for {appid}"))?;
    if !matches!(
        found.health.as_str(),
        "ghost_missing" | "ghost_empty" | "unmanaged_ghost" | "unmanaged_empty" | "leftover_empty"
    ) {
        return Err(format!(
            "appid {appid} is '{}', not a ghost - refusing to clean",
            found.health
        ));
    }
    if !found.lua_managed && !force {
        return Err(format!(
            "appid {appid} is not Lua-managed - pass force to clean anyway"
        ));
    }
    let steamapps = steam_dir.join("steamapps");
    let acf = steamapps.join(format!("appmanifest_{appid}.acf"));
    if found.health == "leftover_empty" {
        // Installed flag already honest; only an empty folder remains.
        // Keep the acf, remove the dir.
        let dir = steamapps.join("common").join(&found.install_dir);
        if found.bytes_on_disk > 0 || found.file_count > 0 {
            return Err(format!("appid {appid}: dir no longer empty - aborting"));
        }
        fs::remove_dir(&dir).map_err(|e| format!("cannot remove empty dir: {e}"))?;
        return Ok(format!(
            "removed empty leftover dir for {} ({appid}); manifest kept",
            found.name
        ));
    }
    let backup_dir = steam_dir.join("micah_mode").join("backups");
    fs::create_dir_all(&backup_dir).map_err(|e| format!("cannot create backups dir: {e}"))?;
    let stamp = std::time::SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let backup = backup_dir.join(format!("appmanifest_{appid}.acf.{stamp}.bak"));
    fs::copy(&acf, &backup).map_err(|e| format!("backup failed: {e}"))?;
    if found.dir_exists {
        let dir = steamapps.join("common").join(&found.install_dir);
        if found.bytes_on_disk > 0 || found.file_count > 0 {
            return Err(format!("appid {appid}: dir no longer empty - aborting"));
        }
        fs::remove_dir(&dir).map_err(|e| format!("cannot remove empty dir: {e}"))?;
    }
    fs::remove_file(&acf).map_err(|e| format!("cannot remove acf: {e}"))?;
    Ok(format!(
        "cleaned ghost {} ({appid}); acf backed up to {}",
        found.name,
        backup.display()
    ))
}

/// Inject local game files bypassing CDN 401 (paid games without ownership).
/// Copies `source_dir` (must contain game files, at least one file) into
/// `steamapps/common/<installdir>` and (re)creates `appmanifest_{appid}.acf`
/// with StateFlags 4. `G-{appid}.lua` must exist first (import Lua).
/// Returns human-readable summary.
/// Best-effort live `(branches.public.buildid, [(depot, gid, size)])` from the
/// steamcmd.net PICS mirror. Returns None offline so callers can fall back.
fn fetch_live_depot_info(appid: u32) -> Option<(String, Vec<(u32, String, String)>)> {
    let url = format!("https://api.steamcmd.net/v1/info/{appid}");
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .ok()?;
    let v: serde_json::Value = client
        .get(&url)
        .header("User-Agent", "Micah0xC-App")
        .send()
        .ok()?
        .json()
        .ok()?;
    let app = v.get("data")?.get(appid.to_string())?;
    let buildid = app
        .get("depots")?
        .get("branches")?
        .get("public")?
        .get("buildid")?
        .as_str()?
        .to_string();
    let mut depots = Vec::new();
    if let Some(map) = app.get("depots").and_then(|d| d.as_object()) {
        for (id_str, dep) in map {
            let depot: u32 = match id_str.parse() {
                Ok(d) => d,
                Err(_) => continue,
            };
            let months = dep.get("manifests").and_then(|m| m.get("public"));
            let gid = months
                .and_then(|m| m.get("gid"))
                .and_then(|g| g.as_str())
                .unwrap_or("0")
                .to_string();
            let size = months
                .and_then(|m| m.get("size"))
                .and_then(|g| g.as_str())
                .unwrap_or("0")
                .to_string();
            depots.push((depot, gid, size));
        }
    }
    Some((buildid, depots))
}

fn fetch_live_buildid(appid: u32) -> Option<String> {
    fetch_live_depot_info(appid).map(|(b, _)| b)
}

pub fn inject_local_game<P: AsRef<Path>, Q: AsRef<Path>>(
    steam_dir: P,
    appid: u32,
    source_dir: Q,
) -> Result<String> {
    let steam_dir = validate_steam_dir(&steam_dir)?;
    let source_dir = source_dir.as_ref();
    if !source_dir.is_dir() {
        return Err(format!("source_dir not found: {}", display_path(source_dir)));
    }
    let lua_path = lua_dir(&steam_dir).join(format!("G-{appid}.lua"));
    if !lua_path.exists() {
        return Err(format!("G-{appid}.lua not found — import Lua first"));
    }
    let mut has_any = false;
    for e in fs::read_dir(source_dir).map_err(|e| e.to_string())? {
        if e.is_ok() {
            has_any = true;
            break;
        }
    }
    if !has_any {
        return Err("source_dir is empty".into());
    }
    let steamapps = steam_dir.join("steamapps");
    let acf_path = steamapps.join(format!("appmanifest_{appid}.acf"));
    let install_sub = if acf_path.exists() {
        fs::read_to_string(&acf_path)
            .ok()
            .and_then(|txt| acf_value(&txt, "installdir"))
            .filter(|s| !s.is_empty())
    } else {
        None
    }
    .unwrap_or_else(|| {
        let lua_name = fs::read_to_string(&lua_path)
            .ok()
            .and_then(|txt| parse_game_lua(&format!("G-{appid}.lua"), &txt))
            .map(|g| g.name)
            .unwrap_or_default();
        let sanitized = sanitize_file_stem(&lua_name);
        if sanitized != "game" && !sanitized.starts_with("App_") {
            sanitized
        } else {
            source_dir
                .file_name()
                .and_then(|n| n.to_str())
                .map(|n| sanitize_file_stem(n))
                .filter(|s| s != "game")
                .unwrap_or_else(|| format!("game_{appid}"))
        }
    });
    let install_sub = if appid == 2830030 && install_sub == "App_2830030" {
        "MOTORSLICE".to_string()
    } else {
        install_sub
    };
    let target = steamapps.join("common").join(&install_sub);
    fs::create_dir_all(&target).map_err(|e| format!("cannot create target {}: {e}", target.display()))?;
    fn copy_recursive(src: &Path, dst: &Path) -> Result<(u64, u64)> {
        let mut bytes = 0u64;
        let mut files = 0u64;
        for entry in fs::read_dir(src).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            let src_path = entry.path();
            let dst_path = dst.join(entry.file_name());
            let ft = entry.file_type().map_err(|e| e.to_string())?;
            if ft.is_dir() {
                fs::create_dir_all(&dst_path).map_err(|e| e.to_string())?;
                let (b, f) = copy_recursive(&src_path, &dst_path)?;
                bytes = bytes.saturating_add(b);
                files = files.saturating_add(f);
            } else if ft.is_file() {
                let meta = entry.metadata().map_err(|e| e.to_string())?;
                bytes = bytes.saturating_add(meta.len());
                files = files.saturating_add(1);
                fs::copy(&src_path, &dst_path).map_err(|e| format!("copy {}: {e}", src_path.display()))?;
            }
        }
        Ok((bytes, files))
    }
    let (copied_bytes, copied_files) = copy_recursive(source_dir, &target)?;
    if copied_files == 0 {
        return Err("no files copied".into());
    }
    let (bytes_on_disk, _file_count, has_exe) = dir_usage(&target);
    let lua_text = fs::read_to_string(&lua_path).unwrap_or_default();
    let depots = lua_manifest_depots(&steam_dir, appid);
    // Live buildid makes Steam treat the inject as up-to-date (offers Play
    // instead of forcing an update that would 401). Best-effort: falls back
    // to the first manifest gid when offline.
    let build_id = fetch_live_buildid(appid).unwrap_or_else(|| {
        find_manifest_entries(&lua_text)
            .first()
            .map(|e| e.manifest_gid.clone())
            .unwrap_or_else(|| "0".to_string())
    });
    let acf_name = if acf_path.exists() {
        fs::read_to_string(&acf_path)
            .ok()
            .and_then(|txt| acf_value(&txt, "name"))
            .unwrap_or_else(|| format!("App {appid}"))
    } else {
        fs::read_to_string(&lua_path)
            .ok()
            .and_then(|txt| parse_game_lua(&format!("G-{appid}.lua"), &txt))
            .map(|g| g.name)
            .unwrap_or_else(|| format!("App {appid}"))
    };
    let acf_name = if acf_name.starts_with("App ") && appid == 2830030 {
        "MOTORSLICE".to_string()
    } else {
        acf_name
    };
    let now = std::time::SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let mut acf = String::new();
    acf.push_str("\"AppState\"\n{\n");
    acf.push_str(&format!("\t\"appid\"\t\t\"{appid}\"\n"));
    acf.push_str("\t\"Universe\"\t\t\"1\"\n");
    acf.push_str(&format!("\t\"name\"\t\t\"{}\"\n", acf_name.replace('"', "'")));
    acf.push_str("\t\"StateFlags\"\t\t\"4\"\n");
    acf.push_str(&format!("\t\"installdir\"\t\t\"{}\"\n", install_sub));
    acf.push_str(&format!("\t\"LastUpdated\"\t\t\"{now}\"\n"));
    acf.push_str(&format!("\t\"SizeOnDisk\"\t\t\"{bytes_on_disk}\"\n"));
    acf.push_str(&format!("\t\"buildid\"\t\t\"{build_id}\"\n"));
    // Keep Steam from "repairing" injected files behind our back: update only
    // on launch, never scheduled, and report a clean update result.
    acf.push_str("\t\"AutoUpdateBehavior\"\t\t\"1\"\n");
    acf.push_str("\t\"ScheduledAutoUpdate\"\t\t\"0\"\n");
    acf.push_str("\t\"UpdateResult\"\t\t\"0\"\n");
    acf.push_str("\t\"BytesToDownload\"\t\t\"0\"\n");
    acf.push_str("\t\"BytesDownloaded\"\t\t\"0\"\n");
    acf.push_str("\t\"InstalledDepots\"\n\t{\n");
    let manifest_entries = find_manifest_entries(&lua_text);
    let appid_entries = find_addappid_entries(&lua_text);
    let live_sizes: std::collections::HashMap<u32, String> = fetch_live_depot_info(appid)
        .map(|(_, list)| list.into_iter().map(|(d, _, s)| (d, s)).collect())
        .unwrap_or_default();
    let mut missing_keys: Vec<u32> = Vec::new();
    for depot in &depots {
        let gid = manifest_entries
            .iter()
            .find(|e| e.depot_id == *depot)
            .map(|e| e.manifest_gid.clone())
            .unwrap_or_else(|| "0".to_string());
        acf.push_str(&format!("\t\t\"{depot}\"\n\t\t{{\n\t\t\t\"manifest\"\t\t\"{gid}\"\n"));
        if let Some(size) = live_sizes.get(depot).filter(|s| *s != "0") {
            acf.push_str(&format!("\t\t\t\"size\"\t\t\"{size}\"\n"));
        }
        acf.push_str("\t\t}\n");
        let has_key = appid_entries.iter().any(|e| {
            e.appid == *depot
                && e.depot_key
                    .as_ref()
                    .map(|k| k.len() == 64 && k.chars().all(|c| c.is_ascii_hexdigit()))
                    .unwrap_or(false)
        });
        if !has_key {
            missing_keys.push(*depot);
        }
    }
    acf.push_str("\t}\n}\n");
    if acf_path.exists() {
        let backup_dir = steam_dir.join("micah_mode").join("backups");
        fs::create_dir_all(&backup_dir).ok();
        let bak = backup_dir.join(format!("appmanifest_{appid}.acf.{now}.bak"));
        let _ = fs::copy(&acf_path, &bak);
    }
    fs::write(&acf_path, acf).map_err(|e| format!("cannot write acf: {e}"))?;
    let _ = copied_bytes;
    let mut msg = format!(
        "injected {appid} ({acf_name}) {copied_files} files {bytes_on_disk} bytes -> {} (exe: {})",
        target.display(),
        has_exe
    );
    if !missing_keys.is_empty() {
        msg.push_str(&format!(
            " WARNING: no 64-hex depot key in Lua for depot(s) {:?} — encrypted content will fail to decrypt at launch",
            missing_keys
        ));
    }
    Ok(msg)
}

// ==================== SDK DETECTOR (unlock manager foundation) ====================
//
// Reads an installed game's folder and reports what protects it, so the unlock
// manager can recommend the right tool (or honestly say "not unlockable").
// Detection is filename + PE-header based - fast, no execution, no guessing.

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SdkReport {
    pub appid: u32,
    pub install_path: String,
    pub sdk: String,
    pub arch: String,
    pub steam_api: bool,
    pub eos: bool,
    pub goldberg: bool,
    pub anticheat: Vec<String>,
    pub unlockable: String,
    pub note: String,
}

/// Machine field from a PE header (`MZ` + e_lfanew -> `PE\0\0` + machine).
fn pe_arch(path: &Path) -> Option<String> {
    let bytes = fs::read(path).ok()?;
    if bytes.len() < 0x40 || &bytes[0..2] != b"MZ" {
        return None;
    }
    let lfanew =
        u32::from_le_bytes([bytes[0x3C], bytes[0x3C + 1], bytes[0x3C + 2], bytes[0x3C + 3]])
            as usize;
    let hdr = bytes.get(lfanew..lfanew + 6)?;
    if &hdr[0..4] != b"PE\0\0" {
        return None;
    }
    match u16::from_le_bytes([hdr[4], hdr[5]]) {
        0x8664 => Some("x64".to_string()),
        0x14c => Some("x86".to_string()),
        0xaa64 => Some("arm64".to_string()),
        _ => Some("unknown".to_string()),
    }
}

fn collect_files_limited(dir: &Path, max_depth: u32) -> Vec<PathBuf> {
    let mut out = Vec::new();
    let mut stack = vec![(dir.to_path_buf(), 0u32)];
    while let Some((d, depth)) = stack.pop() {
        let entries = match fs::read_dir(&d) {
            Ok(e) => e,
            Err(_) => continue,
        };
        for entry in entries.flatten() {
            let path = entry.path();
            let is_dir = entry.file_type().map(|t| t.is_dir()).unwrap_or(false);
            if is_dir {
                if depth < max_depth {
                    stack.push((path, depth + 1));
                }
            } else if out.len() < 20000 {
                out.push(path);
            }
        }
    }
    out
}

pub fn detect_game_sdk<P: AsRef<Path>>(steam_dir: P, appid: u32) -> Result<SdkReport> {
    let steam_dir = validate_steam_dir(&steam_dir)?;
    let steamapps = steam_dir.join("steamapps");
    let acf = steamapps.join(format!("appmanifest_{appid}.acf"));
    let text = fs::read_to_string(&acf)
        .map_err(|_| format!("appid {appid} is not installed (no appmanifest)"))?;
    let sub = acf_value(&text, "installdir")
        .filter(|s| !s.is_empty())
        .ok_or_else(|| format!("appid {appid}: appmanifest has no installdir"))?;
    let dir = steamapps.join("common").join(&sub);
    if !dir.is_dir() {
        return Err(format!("appid {appid}: install folder missing"));
    }
    let files = collect_files_limited(&dir, 2);
    let lower: Vec<String> = files
        .iter()
        .filter_map(|p| {
            p.file_name()
                .and_then(|n| n.to_str())
                .map(|n| n.to_ascii_lowercase())
        })
        .collect();
    let has = |name: &str| lower.iter().any(|n| n == name);
    let has_dir_named = |want: &str| {
        files.iter().any(|p| {
            p.file_name()
                .and_then(|n| n.to_str())
                .map(|n| n.eq_ignore_ascii_case(want))
                .unwrap_or(false)
        })
    };
    let steam_api = has("steam_api.dll") || has("steam_api64.dll");
    let eos = has("eosdk-win32-shipping.dll") || has("eosdk-win64-shipping.dll");
    let goldberg = has("steam_appid.txt")
        && (has("steam_api_o.dll")
            || has("steamclient_o.dll")
            || lower.iter().any(|n| n.starts_with("steam_settings")));
    let uplay = has("uplay_r1_loader.dll")
        || has("uplay_r1_loader64.dll")
        || has("uplay_r2_loader.dll")
        || has("uplay_r2_loader64.dll");
    let mut anticheat = Vec::new();
    if has_dir_named("EasyAntiCheat") || has("easyanticheat_x64.dll") || has("easyanticheat_x86.dll") {
        anticheat.push("EasyAntiCheat".to_string());
    }
    if has_dir_named("BattlEye") || has("beclient_x64.dll") || has("beclient.dll") {
        anticheat.push("BattlEye".to_string());
    }
    if has("vgc.exe") || has_dir_named("Vanguard") {
        anticheat.push("Vanguard".to_string());
    }
    if has_dir_named("Xigncode") || has("xigncode3.sys") {
        anticheat.push("Xigncode".to_string());
    }
    if has_dir_named("nProtect") || has("gameguard.des") {
        anticheat.push("nProtect".to_string());
    }
    // Architecture from the main API dll when present.
    let mut arch = "unknown".to_string();
    for probe in ["steam_api64.dll", "steam_api.dll"] {
        if let Some(path) = files.iter().find(|p| {
            p.file_name()
                .and_then(|n| n.to_str())
                .map(|n| n.eq_ignore_ascii_case(probe))
                .unwrap_or(false)
        }) {
            if let Some(a) = pe_arch(path) {
                arch = a;
                break;
            }
        }
    }
    let (sdk, unlockable, note) = if goldberg {
        (
            "goldberg".to_string(),
            "unlocked".to_string(),
            "Goldberg emu files present - game already runs outside Steam DRM.".to_string(),
        )
    } else if !anticheat.is_empty() {
        (
            if steam_api {
                "steamworks".to_string()
            } else if eos {
                "eos".to_string()
            } else {
                "unknown".to_string()
            },
            "no".to_string(),
            format!(
                "Anti-cheat detected ({}): unlockers will be flagged or blocked.",
                anticheat.join(", ")
            ),
        )
    } else if steam_api {
        (
            "steamworks".to_string(),
            "yes".to_string(),
            "Steamworks DLC check - SmokeAPI/CreamAPI candidate (except Denuvo SecureDLC / server-checked games).".to_string(),
        )
    } else if eos {
        (
            "eos".to_string(),
            "yes".to_string(),
            "EOS SDK DLC check - ScreamAPI candidate.".to_string(),
        )
    } else if uplay {
        (
            "uplay".to_string(),
            "partial".to_string(),
            "Ubisoft launcher title - Uplay unlocker may help, often needs extra work.".to_string(),
        )
    } else {
        (
            "unknown".to_string(),
            "unknown".to_string(),
            "No recognized SDK dll found in the top 2 folder levels.".to_string(),
        )
    };
    Ok(SdkReport {
        appid,
        install_path: display_path(&dir),
        sdk,
        arch,
        steam_api,
        eos,
        goldberg,
        anticheat,
        unlockable,
        note,
    })
}
#[cfg(test)]
mod tests {
    use super::*;

    fn temp_steam_dir() -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "micah_test_{}",
            std::time::SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn sanitize_file_stem_cleans_names() {
        assert_eq!(sanitize_file_stem("Elden Ring"), "Elden_Ring");
        assert_eq!(sanitize_file_stem("Cyberpunk 2077"), "Cyberpunk_2077");
        assert_eq!(sanitize_file_stem("Game/Name!"), "Game_Name");
        assert_eq!(sanitize_file_stem(""), "game");
        assert_eq!(sanitize_file_stem("   "), "game");
    }

    #[test]
    fn register_lua_scripts_path_adds_and_preserves_other_sections() {
        let steam = temp_steam_dir();
        let original = "[log]\nlevel = \"info\"\n\n[manifest]\nurl = \"wudrm\"\n\n[lua]\npaths = [\"C:/existing/a\"]\n\n[remote]\nurl_template = \"x\"\n";
        fs::write(steam.join("micah_mode.toml"), original).unwrap();

        let scripts = steam.join("..").join("lua_scripts");
        let changed = register_lua_scripts_path(&steam, &scripts).unwrap();
        assert!(changed);

        let updated = fs::read_to_string(steam.join("micah_mode.toml")).unwrap();
        let escaped = format!("\"{}\"", escape_toml(&display_path(&scripts)));
        assert!(updated.contains(&escaped));
        assert!(updated.contains("[log]"));
        assert!(updated.contains("[manifest]"));
        assert!(updated.contains("[remote]"));
        assert!(updated.contains("C:/existing/a"));
        assert!(updated.contains("level = \"info\""));
        assert!(updated.contains("url_template = \"x\""));

        // Second call must be a no-op.
        let changed_again = register_lua_scripts_path(&steam, &scripts).unwrap();
        assert!(!changed_again);

        fs::remove_dir_all(&steam).unwrap();
    }

    #[test]
    fn register_lua_scripts_path_creates_missing_file() {
        let steam = temp_steam_dir();
        let scripts = steam.join("..").join("lua_scripts");
        let changed = register_lua_scripts_path(&steam, &scripts).unwrap();
        assert!(changed);
        let updated = fs::read_to_string(steam.join("micah_mode.toml")).unwrap();
        let escaped = format!("\"{}\"", escape_toml(&display_path(&scripts)));
        assert!(updated.contains(&escaped));
        assert!(updated.contains("[manifest]"));
        assert!(updated.contains("url = \"wudrm\""));
        fs::remove_dir_all(&steam).unwrap();
    }

    #[test]
    fn register_lua_scripts_path_adds_missing_manifest_section() {
        let steam = temp_steam_dir();
        let original = "[lua]\npaths = [\"C:/existing/a\"]\n";
        fs::write(steam.join("micah_mode.toml"), original).unwrap();

        let scripts = steam.join("..").join("lua_scripts");
        let changed = register_lua_scripts_path(&steam, &scripts).unwrap();
        assert!(changed);

        let updated = fs::read_to_string(steam.join("micah_mode.toml")).unwrap();
        assert!(updated.contains("[manifest]"));
        assert!(updated.contains("url = \"wudrm\""));
        assert!(updated.contains("C:/existing/a"));
        fs::remove_dir_all(&steam).unwrap();
    }

    #[test]
    fn register_lua_scripts_path_fixes_manifest_on_already_registered_config() {
        let steam = temp_steam_dir();
        let scripts = steam.join("..").join("lua_scripts");
        let escaped = escape_toml(&display_path(&scripts));
        let original = format!("[lua]\npaths = [\"{}\"]\n", escaped);
        fs::write(steam.join("micah_mode.toml"), original).unwrap();

        let changed = register_lua_scripts_path(&steam, &scripts).unwrap();
        assert!(changed);
        let updated = fs::read_to_string(steam.join("micah_mode.toml")).unwrap();
        assert!(updated.contains("[manifest]"));
        assert!(updated.contains("url = \"wudrm\""));
        fs::remove_dir_all(&steam).unwrap();
    }

    #[test]
    fn name_cache_ttl_expires_old_entries() {
        // Must exceed NAME_CACHE_TTL_SECS so the "expired" fixture below
        // cannot underflow (u64 debug arithmetic aborts the suite).
        let now = 10_000_000u64;
        let mut cache = NameCacheMap::new();
        cache.insert(
            730,
            NameCacheEntry { name: "Counter-Strike 2".into(), fetched_at: now },
        );
        cache.insert(
            570,
            NameCacheEntry {
                name: "Dota 2".into(),
                fetched_at: now - NAME_CACHE_TTL_SECS - 1,
            },
        );
        assert_eq!(fresh_cached_name(&cache, 730, now), Some("Counter-Strike 2".into()));
        assert_eq!(fresh_cached_name(&cache, 570, now), None);
        assert_eq!(fresh_cached_name(&cache, 1, now), None);
    }

    #[test]
    fn apply_fresh_gids_updates_stale_entries() {
        let mut game = GameConfig {
            appid: 3548580,
            name: "Test".into(),
            enabled: true,
            depot_key: None,
            access_token: None,
            manifest_gid: None,
            app_ticket_hex: None,
            e_ticket_hex: None,
            stat_steam_id: None,
            appid_entries: vec![],
            manifest_entries: vec![
                ManifestEntry { depot_id: 3548581, manifest_gid: "4284817031895201949".into() },
                ManifestEntry { depot_id: 3548582, manifest_gid: "1716176168712117977".into() },
            ],
        };
        let fresh = vec![
            (3548581u32, "3106235381077599058".to_string()),
            (3548582u32, "1716176168712117977".to_string()),
        ];
        let mut warnings = Vec::new();
        let (updated, unchanged) = apply_fresh_gids(&mut game, &fresh, &mut warnings);
        assert_eq!(updated.len(), 1);
        assert_eq!(updated[0].depot_id, 3548581);
        assert_eq!(updated[0].old_gid, "4284817031895201949");
        assert_eq!(updated[0].new_gid, "3106235381077599058");
        assert_eq!(unchanged, 1);
        assert!(warnings.is_empty());
        assert_eq!(game.manifest_entries[0].manifest_gid, "3106235381077599058");
    }

    #[tokio::test]
    async fn fetch_steamcmd_public_gids_live() {
        let gids = fetch_steamcmd_public_gids(3548580)
            .await
            .expect("steamcmd.net must be reachable");
        let entry = gids
            .iter()
            .find(|(depot, _)| *depot == 3548581)
            .expect("depot 3548581 must be listed");
        assert!(!entry.1.is_empty() && entry.1.chars().all(|c| c.is_ascii_digit()));
    }

    #[tokio::test]
    async fn refresh_paths_rewrites_stale_lua() {
        let dir = temp_steam_dir();
        let stale = "-- G-Micah_Mode: 3548580 App 3548580\n\
            -- GOST-META: {\"appid\":3548580,\"name\":\"App 3548580\",\"enabled\":true,\"depot_key\":null,\"access_token\":null,\"manifest_gid\":null,\"app_ticket_hex\":null,\"e_ticket_hex\":null,\"stat_steam_id\":null,\"appid_entries\":[{\"appid\":3548580}],\"manifest_entries\":[{\"depot_id\":3548581,\"manifest_gid\":\"4284817031895201949\"}]}\n\
            addappid(3548580)\n\
            setManifestid(3548581, \"4284817031895201949\")\n";
        let path = dir.join("G-3548580.lua");
        fs::write(&path, stale).unwrap();
        let summary = refresh_manifest_gids_for_paths(None, 3548580, &[path.clone()])
            .await
            .expect("refresh must succeed");
        assert_eq!(summary.updated.len(), 1);
        assert_eq!(summary.updated[0].depot_id, 3548581);
        assert_eq!(summary.files_written.len(), 1);
        let rewritten = fs::read_to_string(&path).unwrap();
        assert!(!rewritten.contains("4284817031895201949"));
        assert!(rewritten.contains(&summary.updated[0].new_gid));
        // GOST-META header must track the new gid too.
        assert!(rewritten.contains(&summary.updated[0].new_gid));
        fs::remove_dir_all(&dir).unwrap();
    }

    // Real-world shape (Cuphead 268910, 2026-09-09): 5 manifest entries
    // including shared depot 228990 which has no public manifest of its own.
    #[tokio::test]
    async fn refresh_paths_rewrites_cuphead_multi_depot() {
        let dir = temp_steam_dir();
        let stale = "-- G-OpenSteamTool: 268910 App 268910\n\
            -- GOST-META: {\"appid\":268910,\"name\":\"App 268910\",\"enabled\":true,\"depot_key\":null,\"access_token\":null,\"manifest_gid\":\"1829726630299308803\",\"app_ticket_hex\":null,\"e_ticket_hex\":null,\"stat_steam_id\":null,\"appid_entries\":[{\"appid\":268910}],\"manifest_entries\":[{\"depot_id\":228990,\"manifest_gid\":\"1829726630299308803\"},{\"depot_id\":268911,\"manifest_gid\":\"6818141525323043853\"},{\"depot_id\":268912,\"manifest_gid\":\"8633535714830637397\"},{\"depot_id\":1117850,\"manifest_gid\":\"468317947627682665\"},{\"depot_id\":1117851,\"manifest_gid\":\"819870908970387521\"}]}\n\
            addappid(268910)\n\
            setManifestid(228990, \"1829726630299308803\")\n\
            setManifestid(268911, \"6818141525323043853\")\n\
            setManifestid(268912, \"8633535714830637397\")\n\
            setManifestid(1117850, \"468317947627682665\")\n\
            setManifestid(1117851, \"819870908970387521\")\n";
        let path = dir.join("G-268910.lua");
        fs::write(&path, stale).unwrap();
        let summary = refresh_manifest_gids_for_paths(None, 268910, &[path.clone()])
            .await
            .expect("refresh must succeed");
        // Every depot with a public manifest must move forward; the shared
        // depot without one stays pinned with a warning.
        let live = fetch_steamcmd_public_gids(268910)
            .await
            .expect("steamcmd.net must be reachable");
        let live_count = live.len();
        assert!(
            summary.updated.len() >= live_count.saturating_sub(1),
            "expected most depots refreshed: {summary:?}"
        );
        for entry in &summary.updated {
            let (_, current) = live
                .iter()
                .find(|(depot, _)| *depot == entry.depot_id)
                .expect("updated depot must exist upstream");
            assert_eq!(&entry.new_gid, current);
            assert_ne!(entry.old_gid, entry.new_gid);
        }
        assert!(summary.warnings.iter().any(|w| w.contains("228990")));
        let rewritten = fs::read_to_string(&path).unwrap();
        for entry in &summary.updated {
            assert!(!rewritten.contains(entry.old_gid.as_str()));
            assert!(rewritten.contains(entry.new_gid.as_str()));
        }
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn parse_manifest_code_overrides_mixed_formats() {
        let text = "# comment\n\
            // another comment\n\
            3548581: 16782820641112046662\n\
            268911 9583577895947565757\n\
            1117850=7764187989484304781\n\
            - 228990: 123\n\
            garbage line here\n\
            12345\n\
            3548581: 9999999999999999999\n\
            111: 0\n";
        let out = parse_manifest_code_overrides(text);
        // depot 3548581 twice → last wins; `111: 0` dropped (zero code);
        // single-number and garbage lines skipped.
        assert_eq!(out.len(), 4);
        let get = |d| out.iter().find(|(x, _)| *x == d).map(|(_, c)| c.clone());
        assert_eq!(get(3548581).as_deref(), Some("9999999999999999999"));
        assert_eq!(get(268911).as_deref(), Some("9583577895947565757"));
        assert_eq!(get(1117850).as_deref(), Some("7764187989484304781"));
        assert_eq!(get(228990).as_deref(), Some("123"));
    }

    #[test]
    fn read_log_tail_returns_most_recent_lines() {
        let steam = temp_steam_dir();
        let path = steam.join("big.log");
        let mut big = String::new();
        for i in 0..10_000 {
            big.push_str(&format!("line {i}\n"));
        }
        fs::write(&path, &big).unwrap();
        let tail = read_log_tail(&path);
        assert!(tail.len() < MAX_LOG_TAIL as usize + 80);
        assert!(tail.starts_with("line "));
        assert!(tail.contains("line 9999"));
        assert!(!tail.contains("line 0\n"));
        fs::remove_dir_all(&steam).unwrap();
    }

    #[test]
    fn hub3_raw_url_is_canonical() {
        assert_eq!(
            hub3_raw_url(268910, 268911, "123"),
            "https://raw.githubusercontent.com/steamtools-games/ManifestHub3/268910/268911_123.manifest"
        );
    }

    #[test]
    fn patch_lua_gid_replaces_matching_depot_only() {
        let text = "addappid(1)\nsetManifestid(11,\"111\")\nsetManifestid(22,\"222\")\n";
        let (next, changed) = patch_lua_gid_text(text, 22, "999");
        assert!(changed);
        assert!(next.contains("setManifestid(22,\"999\")"));
        assert!(next.contains("setManifestid(11,\"111\")"));
        // Byte-for-byte except the gid.
        assert_eq!(next, "addappid(1)\nsetManifestid(11,\"111\")\nsetManifestid(22,\"999\")\n");
    }

    #[test]
    fn patch_lua_gid_case_insensitive_and_missing() {
        let text = "SETMANIFESTID(11,\"111\")\n";
        let (next, changed) = patch_lua_gid_text(text, 11, "222");
        assert!(changed);
        assert!(next.contains("\"222\""));
        let (_, unchanged) = patch_lua_gid_text(text, 99, "222");
        assert!(!unchanged);
        // Non-digit inner string is left alone.
        let weird = "setManifestid(11,\"abc\")\n";
        let (_, unchanged) = patch_lua_gid_text(weird, 11, "222");
        assert!(!unchanged);
    }

    #[test]
    fn cached_gids_for_lists_only_us() {
        let steam = temp_steam_dir();
        let dc = steam.join("depotcache");
        fs::create_dir_all(&dc).unwrap();
        fs::write(dc.join("11_111.manifest"), b"x").unwrap();
        fs::write(dc.join("11_999.manifest"), b"y").unwrap();
        fs::write(dc.join("11_empty.manifest"), b"").unwrap();
        fs::write(dc.join("22_222.manifest"), b"z").unwrap();
        fs::write(dc.join("notes.txt"), b"nope").unwrap();
        assert_eq!(cached_gids_for(&dc, 11), vec!["111".to_string(), "999".to_string()]);
        assert_eq!(cached_gids_for(&dc, 22), vec!["222".to_string()]);
        assert!(cached_gids_for(&dc, 33).is_empty());
        fs::remove_dir_all(&steam).unwrap();
    }

    #[test]
    fn classify_depot_matrix() {
        assert_eq!(classify_depot(false, false, false), "no_key");
        assert_eq!(classify_depot(false, true, true), "no_key");
        assert_eq!(classify_depot(true, true, true), "ready");
        assert_eq!(classify_depot(true, false, true), "stale");
        assert_eq!(classify_depot(true, false, false), "missing");
    }

    // Live-network test (like fetch_steamcmd_public_gids_live): seeds into a
    // throwaway Steam dir. Asserts structural invariants only — mirror
    // contents drift over time, so we accept seeded OR missing per depot.
    #[test]
    fn seed_manifests_live_structural() {
        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();
        rt.block_on(async {
            let steam = temp_steam_dir();
            fs::write(steam.join("steam.exe"), b"fake").unwrap();
            fs::create_dir_all(lua_dir(&steam)).unwrap();
            fs::write(
                lua_dir(&steam).join("G-424840.lua"),
                b"addappid(424840)\naddappid(424841,0,\"4bd410e2ecc28dd07ee6d887a275a6b32edaeca1e6d401ccab204fe35bd9b99d\")\nsetManifestid(424841,\"1\")\n",
            )
            .unwrap();
            let res = seed_manifests(
                Some(steam.to_string_lossy().as_ref()),
                424840,
                None,
            )
            .await
            .expect("seed_manifests must not error on a valid setup");
            assert_eq!(res.appid, 424840);
            let live = fetch_steamcmd_public_gids(424840).await.unwrap();
            assert_eq!(
                res.seeded.len() + res.already_cached.len() + res.missing.len(),
                live.len(),
                "every live depot is accounted for"
            );
            for s in &res.seeded {
                let data = fs::read(&s.path).unwrap();
                assert!(manifest_looks_valid(&data));
            }
            fs::remove_dir_all(&steam).unwrap();
        });
    }

    #[test]
    fn merge_missing_keys_appends_only_gaps() {
        let text = "addappid(1)\naddappid(11,0,\"4bd410e2ecc28dd07ee6d887a275a6b32edaeca1e6d401ccab204fe35bd9b99d\")\n";
        let keys = vec![
            (11u32, "4bd410e2ecc28dd07ee6d887a275a6b32edaeca1e6d401ccab204fe35bd9b99d".to_string()),
            (22u32, "7f9420fcff9ed1d597a17183b7253b3cb1be15c4247e4f1894fa52b455c035fe".to_string()),
            (23u32, "not-hex".to_string()),
        ];
        let (next, added) = merge_missing_keys_text(text, &keys);
        assert_eq!(added, vec![22]);
        assert!(next.contains("addappid(22,0,\"7f9420fcff9ed1d597a17183b7253b3cb1be15c4247e4f1894fa52b455c035fe\")"));
        assert!(!next.contains("not-hex"));
        // Idempotent: second run adds nothing.
        let (_, added_again) = merge_missing_keys_text(&next, &keys);
        assert!(added_again.is_empty());
    }

    // Live-network test: temp Steam dir without Lua → never ready,
    // always names the missing Lua as a blocker (network outcome agnostic).
    #[test]
    fn check_install_ready_without_lua_is_blocked() {
        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();
        rt.block_on(async {
            let steam = temp_steam_dir();
            fs::write(steam.join("steam.exe"), b"fake").unwrap();
            let rep = check_install_ready(
                Some(steam.to_string_lossy().as_ref()),
                424840,
            )
            .await
            .expect("check must not error on a valid dir");
            assert_eq!(rep.appid, 424840);
            assert!(!rep.lua_present);
            assert!(!rep.ready);
            assert!(rep.blockers.iter().any(|b| b.contains("import Lua first")));
            fs::remove_dir_all(&steam).unwrap();
        });
    }

    #[test]
    fn fix_progress_serializes_for_modal() {
        let p = FixLuaProgress {
            appid: 1,
            phase: "seed".to_string(),
            done: 2,
            total: 5,
            message: "depot 11: seeded 99 bytes".to_string(),
        };
        let v = serde_json::to_value(&p).unwrap();
        assert_eq!(v["appid"], 1);
        assert_eq!(v["phase"], "seed");
        assert_eq!(v["done"], 2);
        assert_eq!(v["total"], 5);
    }

    #[test]
    fn is_hex64_guards_key_shape() {
        assert!(is_hex64("4bd410e2ecc28dd07ee6d887a275a6b32edaeca1e6d401ccab204fe35bd9b99d"));
        assert!(!is_hex64(""));
        assert!(!is_hex64("xyz"));
        assert!(!is_hex64(&"ab".repeat(31)));
    }

    #[test]
    fn manifest_looks_valid_filters_junk() {
        assert!(!manifest_looks_valid(b""));
        assert!(!manifest_looks_valid(b"too short"));
        assert!(manifest_looks_valid(&[0xd0, 0x17, 0xf6, 0x71, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]));
        assert!(manifest_looks_valid(&vec![7u8; 2048]));
    }
}
#[cfg(test)]
mod health_tests {
    use super::*;

    fn temp_health_steam() -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "micah_health_{}",
            std::time::SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(dir.join("steamapps")).unwrap();
        fs::write(dir.join("steam.exe"), b"fake").unwrap();
        dir
    }

    fn write_acf(steam: &Path, appid: u32, flags: u32, sub: &str) {
        let body = format!(
            "\"AppState\"\n{{\n\t\"appid\"\t\t\"{appid}\"\n\t\"name\"\t\t\"Game {appid}\"\n\t\"StateFlags\"\t\t\"{flags}\"\n\t\"installdir\"\t\t\"{sub}\"\n\t\"SizeOnDisk\"\t\t\"0\"\n\t\"buildid\"\t\t\"123\"\n}}\n"
        );
        fs::write(
            steam
                .join("steamapps")
                .join(format!("appmanifest_{appid}.acf")),
            body,
        )
        .unwrap();
    }

    #[test]
    fn acf_value_reads_top_level() {
        let text = "\"AppState\"\n{\n\t\"appid\"\t\t\"2173930\"\n\t\"StateFlags\"\t\t\"4\"\n\t\"InstalledDepots\"\n\t{\n\t}\n}\n";
        assert_eq!(acf_value(text, "appid").as_deref(), Some("2173930"));
        assert_eq!(acf_value(text, "StateFlags").as_deref(), Some("4"));
        assert_eq!(acf_value(text, "InstalledDepots"), None);
        assert_eq!(acf_value(text, "nope"), None);
    }

    #[test]
    fn scan_flags_ghost_missing_managed() {
        let steam = temp_health_steam();
        write_acf(&steam, 999001, 4, "Missing Game");
        let rows = scan_install_health(&steam).unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].health, "unmanaged_ghost");
        assert!(!rows[0].can_auto_clean);
        fs::create_dir_all(lua_dir(&steam)).unwrap();
        fs::write(lua_dir(&steam).join("G-999001.lua"), b"addappid(999001)\n").unwrap();
        let rows = scan_install_health(&steam).unwrap();
        assert_eq!(rows[0].health, "ghost_missing");
        assert!(rows[0].can_auto_clean);
        fs::remove_dir_all(&steam).unwrap();
    }

    #[test]
    fn scan_flags_ghost_empty_and_healthy() {
        let steam = temp_health_steam();
        fs::create_dir_all(lua_dir(&steam)).unwrap();
        write_acf(&steam, 999002, 4, "Empty Game");
        fs::create_dir_all(
            steam
                .join("steamapps")
                .join("common")
                .join("Empty Game"),
        )
        .unwrap();
        fs::write(lua_dir(&steam).join("G-999002.lua"), b"addappid(999002)\n").unwrap();
        write_acf(&steam, 999003, 4, "Full Game");
        let full = steam.join("steamapps").join("common").join("Full Game");
        fs::create_dir_all(&full).unwrap();
        fs::write(full.join("game.exe"), vec![0u8; 100]).unwrap();
        fs::write(lua_dir(&steam).join("G-999003.lua"), b"addappid(999003)\n").unwrap();
        let rows = scan_install_health(&steam).unwrap();
        assert_eq!(rows.len(), 2);
        assert_eq!(rows[0].health, "ghost_empty");
        assert!(rows[0].can_auto_clean);
        assert_eq!(rows[1].health, "healthy");
        assert!(!rows[1].can_auto_clean);
        fs::remove_dir_all(&steam).unwrap();
    }

    #[test]
    fn clean_ghost_removes_and_backs_up() {
        let steam = temp_health_steam();
        fs::create_dir_all(lua_dir(&steam)).unwrap();
        write_acf(&steam, 999004, 4, "Gone Game");
        fs::write(lua_dir(&steam).join("G-999004.lua"), b"addappid(999004)\n").unwrap();
        let msg = clean_ghost(&steam, 999004, false).unwrap();
        assert!(msg.contains("cleaned ghost"));
        assert!(!steam
            .join("steamapps")
            .join("appmanifest_999004.acf")
            .exists());
        let backups: Vec<_> = fs::read_dir(steam.join("micah_mode").join("backups"))
            .unwrap()
            .collect();
        assert_eq!(backups.len(), 1);
        fs::remove_dir_all(&steam).unwrap();
    }

    #[test]
    fn clean_ghost_refuses_healthy_and_unmanaged() {
        let steam = temp_health_steam();
        fs::create_dir_all(lua_dir(&steam)).unwrap();
        write_acf(&steam, 999005, 4, "Real Game");
        let real = steam.join("steamapps").join("common").join("Real Game");
        fs::create_dir_all(&real).unwrap();
        fs::write(real.join("game.exe"), vec![0u8; 10]).unwrap();
        fs::write(lua_dir(&steam).join("G-999005.lua"), b"addappid(999005)\n").unwrap();
        assert!(clean_ghost(&steam, 999005, false).is_err());
        write_acf(&steam, 999006, 4, "Strange Game");
        assert!(clean_ghost(&steam, 999006, false).is_err());
        let msg = clean_ghost(&steam, 999006, true).unwrap();
        assert!(msg.contains("cleaned ghost"));
        fs::remove_dir_all(&steam).unwrap();
    }
}

#[cfg(test)]
mod lua_import_tests {
    use super::*;

    // Exact TestBELUA output shape (minimal, bare filename, no header/META).
    const TESTBELUA_SAMPLE: &str = "addappid(3548580)\nsetManifestid(3548581,\"3106235381077599058\")\nsetManifestid(3548582,\"468494362528011541\")\n";

    #[test]
    fn bare_filename_resolves_appid() {
        assert_eq!(appid_from_g_lua_name("3548580.lua"), Some(3548580));
        assert_eq!(appid_from_g_lua_name("G-3548580.lua"), Some(3548580));
        assert_eq!(
            appid_from_g_lua_name("G-3548580.lua.disabled"),
            Some(3548580)
        );
        assert_eq!(appid_from_g_lua_name("notes.txt"), None);
    }

    #[test]
    fn legacy_testbelua_sample_parses() {
        let game = parse_game_lua("3548580.lua", TESTBELUA_SAMPLE).expect("parses");
        assert_eq!(game.appid, 3548580);
        assert_eq!(game.manifest_entries.len(), 2);
        assert_eq!(game.manifest_entries[0].depot_id, 3548581);
        // Normalize + render keeps both depots and stays parseable.
        let rendered = render_game_lua(&game).unwrap();
        let back = parse_game_lua("G-3548580.lua", &rendered).expect("reparses");
        assert_eq!(back.manifest_entries.len(), 2);
    }

    #[test]
    fn set_depot_key_lines_merge() {
        let text = "addappid(111)\nsetDepotKey(222,\"ab12\")\nsetDepotKey(111,\"cd34\")\n";
        let game = parse_game_lua("G-111.lua", text).expect("parses");
        let e111 = game
            .appid_entries
            .iter()
            .find(|e| e.appid == 111)
            .unwrap();
        assert_eq!(e111.depot_key.as_deref(), Some("cd34"));
        let e222 = game
            .appid_entries
            .iter()
            .find(|e| e.appid == 222)
            .unwrap();
        assert_eq!(e222.depot_key.as_deref(), Some("ab12"));
    }
}
#[cfg(test)]
mod sdk_tests {
    use super::*;

    fn minimal_pe(machine: u16) -> Vec<u8> {
        let mut b = vec![0u8; 0x100];
        b[0] = b'M';
        b[1] = b'Z';
        let lfanew: u32 = 0x80;
        b[0x3C..0x40].copy_from_slice(&lfanew.to_le_bytes());
        b[0x80..0x84].copy_from_slice(b"PE\0\0");
        b[0x84..0x86].copy_from_slice(&machine.to_le_bytes());
        b
    }

    fn fake_installed_game(files: &[(&str, Option<Vec<u8>>)]) -> PathBuf {
        let steam = std::env::temp_dir().join(format!(
            "micah_sdk_{}",
            std::time::SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&steam).unwrap();
        fs::write(steam.join("steam.exe"), b"fake").unwrap();
        let game = steam.join("steamapps").join("common").join("TestGame");
        fs::create_dir_all(&game).unwrap();
        for (name, content) in files {
            let path = game.join(name);
            if let Some(parent) = path.parent() {
                fs::create_dir_all(parent).unwrap();
            }
            fs::write(&path, content.clone().unwrap_or_else(|| b"x".to_vec())).unwrap();
        }
        let acf = "\"AppState\"\n{\n\t\"appid\"\t\t\"424242\"\n\t\"name\"\t\t\"TestGame\"\n\t\"StateFlags\"\t\t\"4\"\n\t\"installdir\"\t\t\"TestGame\"\n}\n";
        fs::write(
            steam.join("steamapps").join("appmanifest_424242.acf"),
            acf,
        )
        .unwrap();
        steam
    }

    #[test]
    fn pe_arch_parses_machine() {
        let dir = std::env::temp_dir();
        let x64 = dir.join("micah_t_x64.dll");
        let x86 = dir.join("micah_t_x86.dll");
        let bad = dir.join("micah_t_bad.dll");
        fs::write(&x64, minimal_pe(0x8664)).unwrap();
        fs::write(&x86, minimal_pe(0x14c)).unwrap();
        fs::write(&bad, b"not a pe").unwrap();
        assert_eq!(pe_arch(&x64).as_deref(), Some("x64"));
        assert_eq!(pe_arch(&x86).as_deref(), Some("x86"));
        assert_eq!(pe_arch(&bad), None);
        fs::remove_file(&x64).unwrap();
        fs::remove_file(&x86).unwrap();
        fs::remove_file(&bad).unwrap();
    }

    #[test]
    fn detects_steamworks_unlockable() {
        let steam = fake_installed_game(&[("steam_api64.dll", Some(minimal_pe(0x8664)))]);
        let r = detect_game_sdk(&steam, 424242).unwrap();
        assert_eq!(r.sdk, "steamworks");
        assert_eq!(r.arch, "x64");
        assert_eq!(r.unlockable, "yes");
        assert!(r.anticheat.is_empty());
        fs::remove_dir_all(&steam).unwrap();
    }

    #[test]
    fn detects_goldberg_unlocked() {
        let steam = fake_installed_game(&[
            ("steam_appid.txt", None),
            ("steam_api_o.dll", Some(minimal_pe(0x8664))),
        ]);
        let r = detect_game_sdk(&steam, 424242).unwrap();
        assert_eq!(r.sdk, "goldberg");
        assert_eq!(r.unlockable, "unlocked");
        fs::remove_dir_all(&steam).unwrap();
    }

    #[test]
    fn anticheat_blocks_unlock() {
        let steam = fake_installed_game(&[
            ("steam_api64.dll", Some(minimal_pe(0x8664))),
            ("EasyAntiCheat/EasyAntiCheat_x64.dll", None),
        ]);
        let r = detect_game_sdk(&steam, 424242).unwrap();
        assert_eq!(r.unlockable, "no");
        assert_eq!(r.anticheat, vec!["EasyAntiCheat".to_string()]);
        fs::remove_dir_all(&steam).unwrap();
    }

    #[test]
    fn missing_game_errors() {
        let steam = std::env::temp_dir().join(format!(
            "micah_sdk_missing_{}",
            std::time::SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&steam).unwrap();
        fs::write(steam.join("steam.exe"), b"fake").unwrap();
        assert!(detect_game_sdk(&steam, 424242).is_err());
        fs::remove_dir_all(&steam).unwrap();
    }
}
#[cfg(test)]
mod ownership_tests {
    use super::*;

    #[test]
    fn ownership_denied_matches_exact_line() {
        let log = "[2026-09-09 23:26:24] AppID 268910 failed to update ownership ticket (Access Denied)\n[2026-09-09 23:26:24] AppID 431960 finished update\n";
        assert!(ownership_denied_in(log, 268910));
        assert!(!ownership_denied_in(log, 431960));
    }

    #[test]
    fn manifest_401_counts_per_depot_with_boundaries() {
        let log = concat!(
            "cache/hkg/depot/268911/manifest/1/2 - manifest request received 401 (Unauthorized)\n",
            "Received 401 (Unauthorized) HTTP response for depot 268911\n",
            "Received 401 (Unauthorized) HTTP response for depot 2689110\n",
            "Received 200 (OK) HTTP response for depot 268911\n",
        );
        // depot/268911/manifest line + "for depot 268911" line = 2; 2689110 must not match; 200 ignored.
        assert_eq!(count_manifest_401s(log, &[268911]), 2);
        assert_eq!(count_manifest_401s(log, &[268912]), 0);
        assert_eq!(count_manifest_401s(log, &[]), 0);
    }

    #[test]
    fn depotcache_coverage_counts_cached_manifests() {
        let steam = std::env::temp_dir().join(format!(
            "micah_dc_{}",
            std::time::SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&steam).unwrap();
        fs::write(steam.join("steam.exe"), b"fake").unwrap();
        fs::create_dir_all(steam.join("depotcache")).unwrap();
        fs::create_dir_all(lua_dir(&steam)).unwrap();
        // 2 depots in Lua, only depot 11 has a cached manifest file.
        fs::write(
            lua_dir(&steam).join("G-424244.lua"),
            b"addappid(424244)\nsetManifestid(11,\"111\")\nsetManifestid(22,\"222\")\n",
        )
        .unwrap();
        fs::write(steam.join("depotcache").join("11_111.manifest"), b"fake-manifest").unwrap();
        fs::write(steam.join("depotcache").join("11_999.manifest"), b"stale-gid").unwrap();
        fs::write(steam.join("depotcache").join("22_empty.manifest"), b"").unwrap();
        let pairs = lua_manifest_pairs(&steam, 424244);
        assert_eq!(pairs.len(), 2);
        let cached = pairs
            .iter()
            .filter(|(depot, gid)| depotcache_has(&steam, *depot, gid))
            .count();
        // Only exact gid match + non-empty counts; stale gid and empty file do not.
        assert_eq!(cached, 1);
        assert!(depotcache_has(&steam, 11, "111"));
        assert!(!depotcache_has(&steam, 22, "222"));
        assert!(!depotcache_has(&steam, 11, "0"));
        fs::remove_dir_all(&steam).unwrap();
    }

    #[test]
    fn leftover_empty_detected_and_cleaned_dir_only() {
        let steam = std::env::temp_dir().join(format!(
            "micah_left_{}",
            std::time::SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&steam).unwrap();
        fs::write(steam.join("steam.exe"), b"fake").unwrap();
        // Installed flag NOT set (18), but empty dir remains + Lua-managed.
        let acf = "\"AppState\"\n{\n\t\"appid\"\t\t\"777001\"\n\t\"name\"\t\t\"Leftover\"\n\t\"StateFlags\"\t\t\"18\"\n\t\"installdir\"\t\t\"Leftover\"\n}\n";
        fs::create_dir_all(steam.join("steamapps")).unwrap();
        fs::write(
            steam.join("steamapps").join("appmanifest_777001.acf"),
            acf,
        )
        .unwrap();
        fs::create_dir_all(
            steam.join("steamapps").join("common").join("Leftover"),
        )
        .unwrap();
        fs::create_dir_all(steam.join("config").join("lua")).unwrap();
        fs::write(
            steam.join("config").join("lua").join("G-777001.lua"),
            b"addappid(777001)\n",
        )
        .unwrap();
        let rows = scan_install_health(&steam).unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].health, "leftover_empty");
        assert!(rows[0].can_auto_clean);
        let msg = clean_ghost(&steam, 777001, false).unwrap();
        assert!(msg.contains("leftover"));
        // Dir gone, acf KEPT.
        assert!(!steam
            .join("steamapps")
            .join("common")
            .join("Leftover")
            .exists());
        assert!(steam
            .join("steamapps")
            .join("appmanifest_777001.acf")
            .exists());
        fs::remove_dir_all(&steam).unwrap();
    }
}

#[cfg(test)]
mod inject_tests {
    use super::*;

    fn temp_inject_steam() -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "micah_inject_{}",
            std::time::SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(dir.join("steamapps")).unwrap();
        fs::write(dir.join("steam.exe"), b"fake").unwrap();
        dir
    }

    #[test]
    fn inject_writes_guarded_acf_and_warns_missing_keys() {
        let steam = temp_inject_steam();
        fs::create_dir_all(lua_dir(&steam)).unwrap();
        // Lua with manifest but NO depot key.
        fs::write(
            lua_dir(&steam).join("G-424243.lua"),
            b"addappid(424243)\nsetManifestid(424244,\"12345\")\n",
        )
        .unwrap();
        let src = steam.join("srcgame");
        fs::create_dir_all(&src).unwrap();
        fs::write(src.join("game.exe"), vec![0u8; 50]).unwrap();
        let msg = inject_local_game(&steam, 424243, &src).unwrap();
        assert!(msg.contains("WARNING"), "expected missing-key warning: {msg}");
        let acf = fs::read_to_string(
            steam.join("steamapps").join("appmanifest_424243.acf"),
        )
        .unwrap();
        assert!(acf.contains("\"AutoUpdateBehavior\"\t\t\"1\""));
        assert!(acf.contains("\"ScheduledAutoUpdate\"\t\t\"0\""));
        assert!(acf.contains("\"StateFlags\"\t\t\"4\""));
        assert!(acf.contains("\"424244\""));
        // No warning when a valid 64-hex key is present.
        fs::write(
            lua_dir(&steam).join("G-424243.lua"),
            b"addappid(424243)\naddappid(424244,0,\"4bd410e2ecc28dd07ee6d887a275a6b32edaeca1e6d401ccab204fe35bd9b99d\")\nsetManifestid(424244,\"12345\")\n",
        )
        .unwrap();
        let msg2 = inject_local_game(&steam, 424243, &src).unwrap();
        assert!(!msg2.contains("WARNING"), "unexpected warning: {msg2}");
        fs::remove_dir_all(&steam).unwrap();
    }
}

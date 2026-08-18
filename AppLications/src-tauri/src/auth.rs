// Secure session persistence for the cloud sync engine.
//
// The Supabase session (access token / refresh token / profile) is sensitive,
// so we never store it in plain text:
//   1. A random AES-256 key is generated once and stored in the OS keyring
//      (Windows Credential Manager / macOS Keychain / Linux Secret Service).
//   2. The session JSON is encrypted with AES-256-GCM and written to the
//      app data directory as `session.bin` (12-byte nonce || ciphertext).
//
// This keeps the payload size unbounded (Windows Credential Manager has a
// ~2.5KB per-entry limit, too small for a full Supabase session) while the
// key stays inside the platform's secure store.

use aes_gcm::aead::Aead;
use aes_gcm::{Aes256Gcm, Key, KeyInit, Nonce};
use rand::rngs::OsRng;
use rand::RngCore;
use tauri::Manager;

const KEYRING_SERVICE: &str = "com.micah0xc.app";
const KEYRING_ACCOUNT: &str = "session-encryption-key";
const SESSION_FILE: &str = "session.bin";

type AuthResult<T> = Result<T, String>;

fn hex_encode(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

fn hex_decode(hex: &str) -> Option<Vec<u8>> {
    if hex.len() % 2 != 0 {
        return None;
    }
    (0..hex.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&hex[i..i + 2], 16).ok())
        .collect()
}

fn session_dir(app: &tauri::AppHandle) -> AuthResult<std::path::PathBuf> {
    app.path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app data directory: {e}"))
}

/// Load the AES key from the OS keyring, generating and storing it on first use.
fn load_or_create_key() -> AuthResult<[u8; 32]> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, KEYRING_ACCOUNT)
        .map_err(|e| format!("Failed to open keyring: {e}"))?;

    match entry.get_password() {
        Ok(hex) => {
            let bytes = hex_decode(&hex).ok_or("Stored encryption key is corrupted")?;
            if bytes.len() != 32 {
                return Err("Stored encryption key has an invalid length".into());
            }
            let mut key = [0u8; 32];
            key.copy_from_slice(&bytes);
            Ok(key)
        }
        Err(keyring::Error::NoEntry) => {
            let mut key = [0u8; 32];
            OsRng.fill_bytes(&mut key);
            entry
                .set_password(&hex_encode(&key))
                .map_err(|e| format!("Failed to store encryption key: {e}"))?;
            Ok(key)
        }
        Err(e) => Err(format!("Failed to read encryption key: {e}")),
    }
}

fn encrypt(plaintext: &[u8], key: &[u8; 32]) -> AuthResult<Vec<u8>> {
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(key));
    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);
    let ciphertext = cipher
        .encrypt(nonce, plaintext)
        .map_err(|_| "Encryption failed".to_string())?;
    let mut out = nonce_bytes.to_vec();
    out.extend_from_slice(&ciphertext);
    Ok(out)
}

fn decrypt(data: &[u8], key: &[u8; 32]) -> AuthResult<Vec<u8>> {
    if data.len() < 12 {
        return Err("Stored session is corrupted".into());
    }
    let (nonce_bytes, ciphertext) = data.split_at(12);
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(key));
    cipher
        .decrypt(Nonce::from_slice(nonce_bytes), ciphertext)
        .map_err(|_| "Failed to decrypt session".to_string())
}

/// Persist the session JSON (encrypted) to the app data directory.
#[tauri::command]
pub fn auth_store_session(app: tauri::AppHandle, session_json: String) -> AuthResult<()> {
    let key = load_or_create_key()?;
    let encrypted = encrypt(session_json.as_bytes(), &key)?;
    let dir = session_dir(&app)?;
    std::fs::write(dir.join(SESSION_FILE), encrypted).map_err(|e| format!("Failed to write session: {e}"))
}

/// Load and decrypt the stored session JSON. Returns `null` when none exists.
#[tauri::command]
pub fn auth_load_session(app: tauri::AppHandle) -> AuthResult<Option<String>> {
    let path = session_dir(&app)?.join(SESSION_FILE);
    if !path.exists() {
        return Ok(None);
    }
    let data = std::fs::read(&path).map_err(|e| format!("Failed to read session: {e}"))?;
    let key = load_or_create_key()?;
    let plain = decrypt(&data, &key)?;
    String::from_utf8(plain)
        .map(Some)
        .map_err(|e| format!("Stored session is not valid text: {e}"))
}

/// Delete the stored session (used on logout).
#[tauri::command]
pub fn auth_clear_session(app: tauri::AppHandle) -> AuthResult<()> {
    let path = session_dir(&app)?.join(SESSION_FILE);
    match std::fs::remove_file(&path) {
        Ok(_) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(format!("Failed to remove session: {e}")),
    }
}

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager, PhysicalPosition, PhysicalSize, Position, Size, Window, WindowEvent};

/// Persisted window state (size, position, maximized, remember flag).
/// Stored as JSON in the app data dir so it survives restarts.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowState {
    pub remember: bool,
    pub x: i32,
    pub y: i32,
    pub w: u32,
    pub h: u32,
    pub maximized: bool,
}

impl Default for WindowState {
    fn default() -> Self {
        Self {
            remember: true,
            x: 0,
            y: 0,
            w: 1380,
            h: 760,
            maximized: false,
        }
    }
}

fn state_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|dir| dir.join("window-state.json"))
        .map_err(|err| err.to_string())
}

pub fn load_state(app: &AppHandle) -> WindowState {
    let Ok(path) = state_path(app) else {
        return WindowState::default();
    };
    fs::read_to_string(path)
        .ok()
        .and_then(|raw| serde_json::from_str::<WindowState>(&raw).ok())
        .unwrap_or_else(WindowState::default)
}

fn save_state(app: &AppHandle, state: &WindowState) {
    let Ok(path) = state_path(app) else { return };
    if let Some(dir) = path.parent() {
        let _ = fs::create_dir_all(dir);
    }
    if let Ok(json) = serde_json::to_string(state) {
        let _ = fs::write(path, json);
    }
}

/// Restore the saved size/position/maximized state. Call from setup() before
/// the window is shown (window is created with `visible: false`).
pub fn restore(app: &AppHandle) {
    let state = load_state(app);
    if !state.remember {
        return;
    }

    let Some(window) = app.get_webview_window("main") else {
        return;
    };

    if state.maximized {
        let _ = window.maximize();
        let _ = window.show();
        return;
    }

    let _ = window.set_size(Size::Physical(PhysicalSize::new(state.w, state.h)));
    let _ = window.set_position(Position::Physical(PhysicalPosition::new(state.x, state.y)));

    // If the saved position is off-screen (e.g. monitor was unplugged),
    // fall back to the primary monitor's center.
    let on_screen = window
        .available_monitors()
        .map(|monitors| {
            monitors.iter().any(|monitor| {
                let area = monitor.work_area();
                let right = area.position.x + area.size.width as i32;
                let bottom = area.position.y + area.size.height as i32;
                state.x < right
                    && state.x + state.w as i32 > area.position.x
                    && state.y < bottom
                    && state.y + state.h as i32 > area.position.y
            })
        })
        .unwrap_or(false);
    if !on_screen {
        let _ = window.center();
    }

    let _ = window.show();
}

/// Snapshot the current window bounds. Call from the CloseRequested event so
/// the size/position the user last saw is what gets restored next launch.
pub fn save_from_window(window: &Window) {
    let app = window.app_handle();
    let mut state = load_state(&app);
    if !state.remember {
        return;
    }

    state.maximized = window.is_maximized().unwrap_or(false);
    if !state.maximized {
        if let Ok(pos) = window.outer_position() {
            state.x = pos.x;
            state.y = pos.y;
        }
        if let Ok(size) = window.outer_size() {
            state.w = size.width;
            state.h = size.height;
        }
    }
    save_state(&app, &state);
}

/// Whether "remember window" is enabled — used by the Settings UI.
#[tauri::command]
pub fn get_window_remember(app: tauri::AppHandle) -> Result<bool, String> {
    Ok(load_state(&app).remember)
}

/// Toggle "remember window" from the Settings UI.
#[tauri::command]
pub fn set_window_remember(app: tauri::AppHandle, remember: bool) -> Result<(), String> {
    let mut state = load_state(&app);
    state.remember = remember;
    save_state(&app, &state);
    Ok(())
}

/// Expose the saved state to Rust event handlers without importing tauri events
/// into this module's public API surface.
pub fn on_window_event(window: &Window, event: &WindowEvent) {
    if let WindowEvent::CloseRequested { .. } = event {
        save_from_window(window);
    }
}
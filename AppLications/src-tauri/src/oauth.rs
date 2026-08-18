use serde_json::json;
use std::io::{Read, Write};
use std::net::TcpListener;
use std::time::{Duration, Instant};
use tauri::Emitter;

/// Bind a temporary HTTP server on 127.0.0.1 and wait for the OAuth callback.
///
/// Supabase's PKCE redirect is normally a custom scheme (`micah0xc://...`),
/// which leaves the browser tab hanging on Discord's "Redirecting…" spinner.
/// Redirecting to `http://127.0.0.1:<port>/auth/callback` instead lets the
/// browser load a real page that confirms the sign-in and closes itself.
///
/// The command resolves immediately after the server is bound; the callback
/// payload is delivered through the `oauth://callback` event:
///   - `{ "code": "..." }`    — PKCE code to exchange
///   - `{ "error": "..." }`   — authorization error or "timeout"
pub fn start_oauth_callback_listener(
    app: tauri::AppHandle,
    port: u16,
    timeout_secs: u64,
) -> Result<(), String> {
    let listener = TcpListener::bind(("127.0.0.1", port))
        .map_err(|err| format!("Cannot start the OAuth callback server on port {port}: {err}"))?;

    let app_clone = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        listener
            .set_nonblocking(true)
            .map_err(|err| err.to_string())
            .unwrap_or_else(|err| eprintln!("[oauth] set_nonblocking: {err}"));

        let deadline = Instant::now() + Duration::from_secs(timeout_secs.max(1));
        loop {
            match listener.accept() {
                Ok((mut stream, _addr)) => {
                    let mut buf = [0u8; 8192];
                    let n = stream.read(&mut buf).unwrap_or(0);
                    let request = String::from_utf8_lossy(&buf[..n]).to_string();
                    let request_line = request.lines().next().unwrap_or("").to_string();
                    let payload = parse_callback_payload(&request_line);

                    let success = matches!(payload, Some(ref p) if p.code.is_some());
                    let _ = stream.write_all(http_response(success).as_bytes());

                    let event_payload = match payload {
                        Some(p) => {
                            if let Some(code) = p.code {
                                json!({ "code": code })
                            } else {
                                json!({ "error": p.error.unwrap_or_else(|| "Malformed callback URL".into()) })
                            }
                        }
                        None => json!({ "error": "Malformed callback URL" }),
                    };
                    let _ = app_clone.emit("oauth://callback", event_payload);
                    return;
                }
                Err(err) if err.kind() == std::io::ErrorKind::WouldBlock => {
                    if Instant::now() >= deadline {
                        let _ = app_clone.emit("oauth://callback", json!({ "error": "timeout" }));
                        return;
                    }
                    std::thread::sleep(Duration::from_millis(50));
                }
                Err(_) => {
                    let _ = app_clone.emit("oauth://callback", json!({ "error": "listener error" }));
                    return;
                }
            }
        }
    });

    Ok(())
}

struct CallbackPayload {
    code: Option<String>,
    error: Option<String>,
}

/// Parse `GET /auth/callback?code=...&... HTTP/1.1` into the callback payload.
fn parse_callback_payload(request_line: &str) -> Option<CallbackPayload> {
    let path = request_line.split_whitespace().nth(1)?;
    let query = path.split('?').nth(1).unwrap_or("");
    let mut code = None;
    let mut error = None;
    for pair in query.split('&') {
        let (key, value) = pair.split_once('=').unwrap_or((pair, ""));
        match key {
            "code" => code = Some(value.to_string()),
            "error" => error = Some(value.to_string()),
            "error_description" if error.is_none() => error = Some(value.to_string()),
            _ => {}
        }
    }
    if code.is_some() || error.is_some() {
        Some(CallbackPayload { code, error })
    } else {
        None
    }
}

/// Small success/error page shown in the browser tab; closes itself.
fn http_response(success: bool) -> String {
    let (title, color, message) = if success {
        (
            "Signed in",
            "#4d9e6a",
            "Micah 0xC is now linked to your Discord account.",
        )
    } else {
        (
            "Sign-in failed",
            "#e05555",
            "Something went wrong. Please try signing in again.",
        )
    };
    let body = format!(
        "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><title>Micah 0xC — {title}</title>\
         <style>body{{font-family:Segoe UI,system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:80vh;margin:0;background:#f5f3ee}}\
         .card{{background:#fff;border:1px solid #d8d3c8;border-radius:12px;padding:28px 36px;text-align:center;box-shadow:0 6px 24px rgba(0,0,0,.06)}}\
         .dot{{width:10px;height:10px;border-radius:50%;background:{color};display:inline-block;margin-right:8px}}\
         p{{color:#6b6a63;font-size:14px}}</style></head>\
         <body><div class=\"card\"><div style=\"font-weight:700;font-size:16px\"><span class=\"dot\"></span>{title}</div>\
         <p>{message}</p><p style=\"color:#b0ada4;font-size:12px\">You can close this tab now.</p></div>\
         <script>setTimeout(function(){{window.close();}},300)</script></body></html>",
        color = color,
        title = title,
        message = message,
    );
    format!(
        "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        body.len(),
        body
    )
}
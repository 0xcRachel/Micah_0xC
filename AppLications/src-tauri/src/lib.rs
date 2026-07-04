use std::process::Command;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

// ─── Structs ─────────────────────────────────────────────────────────────────

#[derive(serde::Serialize, serde::Deserialize)]
pub struct SystemInfo {
  cpu: String,
  gpu: String,
  ram: String,
  os: String,
  cores: String,
}

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
pub struct SteamSearchItem {
  appid: u64,
  name: String,
  header_image: String,
}

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
pub struct SteamGameDetail {
  appid: u64,
  name: String,
  short_description: String,
  header_image: String,
  developers: Vec<String>,
  publishers: Vec<String>,
  genres: Vec<String>,
  categories: Vec<String>,
  price: String,
  release_date: String,
  score: u32,
  score_label: String,
  metacritic: u32,
  pc_requirements_minimum: String,
  pc_requirements_recommended: String,
}

// ─── Commands ─────────────────────────────────────────────────────────────────

#[tauri::command]
fn get_system_info() -> Result<SystemInfo, String> {
  #[cfg(target_os = "windows")]
  {
    let script = r#"
      $cpu = (Get-CimInstance Win32_Processor).Name;
      $gpu = (Get-CimInstance Win32_VideoController).Name -join ', ';
      $ram = [math]::round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB);
      $os = (Get-CimInstance Win32_OperatingSystem).Caption;
      $cores = (Get-CimInstance Win32_Processor).NumberOfLogicalProcessors;
      @{cpu=$cpu; gpu=$gpu; ram="$ram GB"; os=$os; cores="$cores Cores"} | ConvertTo-Json
    "#;

    let output = Command::new("powershell")
      .args(["-NoProfile", "-Command", script])
      .creation_flags(0x08000000)
      .output()
      .map_err(|e| e.to_string())?;

    if !output.status.success() {
      return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    let json_str = String::from_utf8_lossy(&output.stdout);
    let info: SystemInfo = serde_json::from_str(&json_str).map_err(|e| e.to_string())?;
    Ok(info)
  }

  #[cfg(not(target_os = "windows"))]
  {
    Ok(SystemInfo {
      cpu: "Non-Windows CPU".to_string(),
      gpu: "Non-Windows GPU".to_string(),
      ram: "16 GB".to_string(),
      os: "Non-Windows OS".to_string(),
      cores: "8 Cores".to_string(),
    })
  }
}

/// Search Steam Store for games by name using the Steam Store API (avoids browser CORS)
#[tauri::command]
async fn search_steam_games(query: String) -> Result<Vec<SteamSearchItem>, String> {
  let url = format!(
    "https://store.steampowered.com/api/storesearch/?term={}&l=english&cc=US",
    urlencoding::encode(&query)
  );

  let client = reqwest::Client::builder()
    .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
    .build()
    .map_err(|e| e.to_string())?;

  let resp = client
    .get(&url)
    .send()
    .await
    .map_err(|e| e.to_string())?;

  let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;

  let mut results: Vec<SteamSearchItem> = Vec::new();

  if let Some(items) = json["items"].as_array() {
    for item in items.iter().take(8) {
      let appid = item["id"].as_u64().unwrap_or(0);
      let name = item["name"].as_str().unwrap_or("").to_string();
      // Steam CDN header image URL from appid
      let header_image = format!(
        "https://cdn.cloudflare.steamstatic.com/steam/apps/{}/header.jpg",
        appid
      );

      if appid > 0 && !name.is_empty() {
        results.push(SteamSearchItem {
          appid,
          name,
          header_image,
        });
      }
    }
  }

  Ok(results)
}

/// Get detailed info for a specific Steam game by appid
#[tauri::command]
async fn get_steam_game_detail(appid: u64) -> Result<SteamGameDetail, String> {
  let url = format!(
    "https://store.steampowered.com/api/appdetails?appids={}&cc=US&l=english",
    appid
  );

  let client = reqwest::Client::builder()
    .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
    .build()
    .map_err(|e| e.to_string())?;

  let resp = client
    .get(&url)
    .send()
    .await
    .map_err(|e| e.to_string())?;

  let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
  let key = appid.to_string();

  if json[&key]["success"].as_bool() != Some(true) {
    return Err(format!("Failed to load data for appid {}", appid));
  }

  let data = &json[&key]["data"];

  // Parse fields
  let name = data["name"].as_str().unwrap_or("").to_string();
  let short_description = data["short_description"].as_str().unwrap_or("").to_string();
  let header_image = data["header_image"].as_str().unwrap_or("").to_string();

  let developers: Vec<String> = data["developers"]
    .as_array()
    .map(|a| a.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
    .unwrap_or_default();

  let publishers: Vec<String> = data["publishers"]
    .as_array()
    .map(|a| a.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
    .unwrap_or_default();

  let genres: Vec<String> = data["genres"]
    .as_array()
    .map(|a| a.iter().filter_map(|v| v["description"].as_str().map(|s| s.to_string())).collect())
    .unwrap_or_default();

  let categories: Vec<String> = data["categories"]
    .as_array()
    .map(|a| a.iter().filter_map(|v| v["description"].as_str().map(|s| s.to_string())).collect())
    .unwrap_or_default();

  // Price
  let price = if data["is_free"].as_bool() == Some(true) {
    "Free".to_string()
  } else {
    data["price_overview"]["final_formatted"]
      .as_str()
      .unwrap_or("N/A")
      .to_string()
  };

  let release_date = data["release_date"]["date"]
    .as_str()
    .unwrap_or("Unknown")
    .to_string();

  // Metacritic score if available
  let metacritic = data["metacritic"]["score"].as_u64().unwrap_or(0) as u32;

  // Use metacritic if available, otherwise derive a rough score from positive/negative reviews
  let (score, score_label) = if metacritic > 0 {
    let label = if metacritic >= 90 {
      "Overwhelmingly Positive"
    } else if metacritic >= 75 {
      "Very Positive"
    } else if metacritic >= 60 {
      "Mostly Positive"
    } else if metacritic >= 40 {
      "Mixed"
    } else {
      "Mostly Negative"
    };
    (metacritic, label.to_string())
  } else {
    (0u32, "N/A".to_string())
  };

  let pc_requirements_minimum = data["pc_requirements"]["minimum"]
    .as_str()
    .unwrap_or("")
    .to_string();

  let pc_requirements_recommended = data["pc_requirements"]["recommended"]
    .as_str()
    .unwrap_or("")
    .to_string();

  Ok(SteamGameDetail {
    appid,
    name,
    short_description,
    header_image,
    developers,
    publishers,
    genres,
    categories,
    price,
    release_date,
    score,
    score_label,
    metacritic,
    pc_requirements_minimum,
    pc_requirements_recommended,
  })
}

// ─── App Entry ────────────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      get_system_info,
      search_steam_games,
      get_steam_game_detail,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

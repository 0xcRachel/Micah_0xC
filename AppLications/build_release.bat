@echo off
set "TAURI_SIGNING_PRIVATE_KEY_PATH=C:\Users\Rachel\.tauri\micah0xc.key"
set "TAURI_SIGNING_PRIVATE_KEY_PASSWORD= "
cd /d D:\0xcMain\AppLications
npx tauri build

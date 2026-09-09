@echo off
REM Micah 0xC release build + sign.
REM
REM Tauri's bundler (`tauri build`) reads ONLY TAURI_SIGNING_PRIVATE_KEY.
REM The _PATH variant is honored solely by `tauri signer sign -f`, NOT by
REM the bundler — that mismatch caused "no private key" build failures.
REM This script exports the key CONTENT (works everywhere) plus _PATH.
set "KEYFILE=C:\Users\Rachel\.tauri\micah0xc.key"
set "TAURI_SIGNING_PRIVATE_KEY_PATH=%KEYFILE%"
set "TAURI_SIGNING_PRIVATE_KEY_PASSWORD= "
if not exist "%KEYFILE%" (
  echo [ERROR] Signing key not found: %KEYFILE%
  exit /b 1
)
set /p TAURI_SIGNING_PRIVATE_KEY=<"%KEYFILE%"
if "%TAURI_SIGNING_PRIVATE_KEY%"=="" (
  echo [ERROR] Failed to read signing key content from %KEYFILE%
  exit /b 1
)
cd /d D:\0xcMain\AppLications
npx tauri build

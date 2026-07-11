/**
 * bump-version.js — Cập nhật version đồng bộ trên toàn bộ dự án Tauri.
 *
 * Cách dùng:
 *   node scripts/bump-version.js 0.2.0          # set version = 0.2.0
 *   node scripts/bump-version.js 0.2.0 --build   # set version + chạy build ngay
 *   node scripts/bump-version.js patch            # tăng patch (0.1.0 → 0.2.0)
 *   node scripts/bump-version.js minor            # tăng minor (0.1.0 → 0.2.0)
 *   node scripts/bump-version.js major            # tăng major (0.1.0 → 1.0.0)
 *
 * Tác động:
 *   - src-tauri/Cargo.toml       (Rust backend — dùng cho env!("CARGO_PKG_VERSION"))
 *   - src-tauri/tauri.conf.json  (Tauri app version + installer)
 *   - package.json               (npm package version)
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ==================== Đường dẫn file ====================
const FILES = {
  cargoToml: path.join(ROOT, 'src-tauri', 'Cargo.toml'),
  tauriConf: path.join(ROOT, 'src-tauri', 'tauri.conf.json'),
  packageJson: path.join(ROOT, 'package.json'),
};

// ==================== Helpers ====================

/** Đọc version hiện tại từ Cargo.toml */
function readCurrentVersion() {
  const content = fs.readFileSync(FILES.cargoToml, 'utf-8');
  const match = content.match(/^version\s*=\s*"([^"]+)"/m);
  if (!match) {
    throw new Error('Không tìm thấy version trong Cargo.toml');
  }
  return match[1];
}

/** Tăng version theo loại (patch/minor/major) */
function bumpSemver(version, type) {
  const parts = version.split('.').map(Number);
  if (parts.length < 3) parts.push(0, 0, 0);
  while (parts.length < 3) parts.push(0);

  if (type === 'major') {
    parts[0]++;
    parts[1] = 0;
    parts[2] = 0;
  } else if (type === 'minor') {
    parts[1]++;
    parts[2] = 0;
  } else {
    // patch
    parts[2]++;
  }
  return parts.join('.');
}

/** Validate format semver (x.y.z) */
function isValidSemver(version) {
  return /^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/.test(version);
}

/** Cập nhật version trong Cargo.toml */
function updateCargoToml(newVersion) {
  const content = fs.readFileSync(FILES.cargoToml, 'utf-8');
  // Chỉ thay dòng version đầu tiên (dòng [package] version)
  const updated = content.replace(
    /^version\s*=\s*"[^"]+"/m,
    `version = "${newVersion}"`,
  );
  fs.writeFileSync(FILES.cargoToml, updated, 'utf-8');
}

/** Cập nhật version trong tauri.conf.json */
function updateTauriConf(newVersion) {
  const content = fs.readFileSync(FILES.tauriConf, 'utf-8');
  const json = JSON.parse(content);
  json.version = newVersion;
  // Giữ format 2-space indent cho dễ diff
  fs.writeFileSync(FILES.tauriConf, JSON.stringify(json, null, 2) + '\n', 'utf-8');
}

/** Cập nhật version trong package.json */
function updatePackageJson(newVersion) {
  const content = fs.readFileSync(FILES.packageJson, 'utf-8');
  const json = JSON.parse(content);
  json.version = newVersion;
  fs.writeFileSync(FILES.packageJson, JSON.stringify(json, null, 2) + '\n', 'utf-8');
}

// ==================== Main ====================

const args = process.argv.slice(2);

if (args.length === 0) {
  const current = readCurrentVersion();
  console.log('\n📦 Current version: ' + current);
  console.log('\nCách dùng:');
  console.log('  node scripts/bump-version.js <version>   ví dụ: node scripts/bump-version.js 0.2.0');
  console.log('  node scripts/bump-version.js patch        tăng 0.1.0 → 0.1.1');
  console.log('  node scripts/bump-version.js minor        tăng 0.1.0 → 0.2.0');
  console.log('  node scripts/bump-version.js major        tăng 0.1.0 → 1.0.0');
  console.log('  thêm --build ở cuối để chạy npm run build sau khi bump\n');
  process.exit(0);
}

let input = args[0];
const shouldBuild = args.includes('--build');

// Xác định version mới
let newVersion;
if (['patch', 'minor', 'major'].includes(input)) {
  const current = readCurrentVersion();
  newVersion = bumpSemver(current, input);
  console.log(`\n🔍 Bump ${input}: ${current} → ${newVersion}`);
} else {
  if (!isValidSemver(input)) {
    console.error(`\n❌ Version không hợp lệ: "${input}"`);
    console.error('   Format đúng: x.y.z (ví dụ: 0.2.0)');
    process.exit(1);
  }
  newVersion = input;
  console.log(`\n📦 Set version: ${newVersion}`);
}

// Cập nhật tất cả file
try {
  updateCargoToml(newVersion);
  console.log('  ✓ src-tauri/Cargo.toml');

  updateTauriConf(newVersion);
  console.log('  ✓ src-tauri/tauri.conf.json');

  updatePackageJson(newVersion);
  console.log('  ✓ package.json');

  console.log(`\n✅ Đã cập nhật version lên ${newVersion} trên toàn bộ dự án.\n`);

  // Gợi ý nhắc user cập nhật version-config.json
  console.log('⚠️  NHỚ: Cập nhật latest_version trong version-config.json trên GitHub:');
  console.log(`   "latest_version": "${newVersion}"\n`);

  if (shouldBuild) {
    console.log('🔨 Đang build...');
    execSync('npm run build', { cwd: ROOT, stdio: 'inherit' });
    console.log('✅ Build xong.\n');
  }
} catch (err) {
  console.error('\n❌ Lỗi:', err.message);
  process.exit(1);
}

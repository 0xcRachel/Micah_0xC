// @ts-check
import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';
import { pluginTailwindcss } from '@rsbuild/plugin-tailwindcss';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The .env with Supabase keys lives at the repo root (D:\0xcMain\.env).
// Note: `envDir` is a CLI flag, not a config option, so we load the file
// manually and inject the values via `define` to guarantee they are baked
// into the production bundle.
const envDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadRootEnv() {
  try {
    const raw = readFileSync(path.join(envDir, '.env'), 'utf8');
    const env = {};
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
    return env;
  } catch {
    return {};
  }
}

const rootEnv = loadRootEnv();

// Docs: https://rsbuild.rs/config/
export default defineConfig({
  plugins: [pluginReact(), pluginTailwindcss()],
  source: {
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(rootEnv.VITE_SUPABASE_URL ?? ''),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(
        rootEnv.VITE_SUPABASE_PUBLISHABLE_KEY ?? '',
      ),
    },
  },
  output: {
    assetPrefix: './',
  },
});

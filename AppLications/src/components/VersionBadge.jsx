import React, { useState, useEffect } from 'react';
import { getVersion } from '@tauri-apps/api/app';

// Must match package.json / Cargo.toml. Used only as a fallback
// when getVersion() is unreachable (e.g. plain browser dev).
const FALLBACK_VERSION = '1.0.0';

/**
 * VersionBadge — small pill showing the running app version.
 * Rendered to the LEFT of the Discord AuthBadge so users always
 * know which version they are on.
 */
const VersionBadge = () => {
  const [version, setVersion] = useState(FALLBACK_VERSION);

  useEffect(() => {
    let alive = true;
    getVersion()
      .then((v) => {
        if (alive && v) setVersion(v);
      })
      .catch(() => {
        /* offline / non-tauri: keep fallback */
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div
      className="flex items-center gap-1.5 h-9 rounded-full border shadow-lg
        backdrop-blur-md border-[var(--card-border)]/20 bg-[var(--card-bg)]/85 px-3"
      title={`Micah 0xC v${version}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-[var(--led-color)] shrink-0" />
      <span className="text-[11px] font-bold text-[var(--text-muted)] whitespace-nowrap">
        v{version}
      </span>
    </div>
  );
};

export default VersionBadge;

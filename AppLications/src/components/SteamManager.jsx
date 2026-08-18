import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import * as api from '../api.ts';
import { useSync } from '../sync/SyncProvider';
import './SteamManager.css';


const Led = ({ on, warn }) => {
  if (on === undefined || on === null) return <span className="sm-led grey" />;
  if (warn) return <span className="sm-led yellow" />;
  return <span className={`sm-led ${on ? 'green' : 'red'}`} />;
};

const Spinner = () => <span className="sm-spinner" aria-label="loading" />;

const Toast = ({ message, type }) =>
  message ? (
    <div className="sm-toast-wrap">
      <div className={`sm-toast ${type}`}>{message}</div>
    </div>
  ) : null;

const useToast = () => {
  const [toast, setToast] = useState(null);
  const timerRef = useRef(null);

  const show = useCallback((msg, type = 'success', ms = 3000) => {
    clearTimeout(timerRef.current);
    setToast({ message: msg, type });
    timerRef.current = setTimeout(() => setToast(null), ms);
  }, []);

  useEffect(() => () => clearTimeout(timerRef.current), []);
  return { toast, show };
};

// Normalize a Rust/JS error into a short, single-line toast message.
const toastError = (show, prefix, err, ms = 6000) => {
  let msg = String(err?.message ?? err ?? 'Unknown error').trim();
  msg = msg.split('\n')[0];
  if (msg.length > 140) msg = `${msg.slice(0, 137)}…`;
  show(prefix ? `${prefix}: ${msg}` : msg, 'error', ms);
};

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ==================== TAB: STATUS ====================

const dllStateColor = (state) => ({
  Managed: 'green',
  Missing: 'red',
  Foreign: 'yellow',
}[state] ?? 'grey');

const loadStateLabel = (ls) => ({
  Loaded: 'Loaded',
  NotLoaded: 'Not Loaded',
  SteamNotRunning: 'Steam Off',
  VerifyFailed: 'Verify Failed',
}[ls] ?? ls);

const TabStatus = ({ steamDir, scanData, onRefresh, loading }) => {
  if (!steamDir) return <p className="sm-empty">Select a Steam directory first.</p>;
  // Only block the whole view on the very first scan — during a re-scan we
  // keep the previous data on screen and show a subtle hint instead.
  if (!scanData && loading) return <p className="sm-empty"><Spinner /> Scanning…</p>;
  if (!scanData) return (
    <p className="sm-empty">
      <button className="sm-btn primary" onClick={onRefresh}>Scan Now</button>
    </p>
  );

  const s = scanData;
  return (
    <>
      {loading && <p className="sm-scanning-hint"><Spinner /> Scanning…</p>}
      <div className="sm-status-grid">
        <div className="sm-status-card">
          <span className="sm-status-card-label">Steam Running</span>
          <span className="sm-status-card-value" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Led on={s.steam_running} /> {s.steam_running ? 'Yes' : 'No'}
          </span>
        </div>
        <div className="sm-status-card">
          <span className="sm-status-card-label">Version</span>
          <span className="sm-status-card-value">{s.steam_version ?? '—'}</span>
        </div>
        <div className="sm-status-card">
          <span className="sm-status-card-label">Config File</span>
          <span className="sm-status-card-value" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Led on={s.config_exists} /> {s.config_exists ? 'Found' : 'Missing'}
          </span>
        </div>
        <div className="sm-status-card">
          <span className="sm-status-card-label">Lua Games</span>
          <span className="sm-status-card-value">{s.lua_count}</span>
        </div>
        <div className="sm-status-card">
          <span className="sm-status-card-label">DLL Resources</span>
          <span className="sm-status-card-value" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Led on={s.dll_resources_ready} /> {s.dll_resources_ready ? 'Ready' : 'Missing'}
          </span>
        </div>
        <div className="sm-status-card">
          <span className="sm-status-card-label">Log Files</span>
          <span className="sm-status-card-value">{s.log_files.length}</span>
        </div>
      </div>

      <p className="sm-section-title">DLL Status</p>
      <table className="sm-dll-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>State</th>
            <th>Hash</th>
            <th>Load State</th>
          </tr>
        </thead>
        <tbody>
          {s.dlls.map(dll => (
            <tr key={dll.name}>
              <td style={{ fontFamily: 'monospace' }}>{dll.name}</td>
              <td>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Led on={dll.state === 'Managed'} warn={dll.state === 'Foreign'} />
                  {dll.state}
                </span>
              </td>
              <td><Led on={dll.hash_matched} /></td>
              <td style={{ color: dll.load_state === 'Loaded' ? 'var(--led-color)' : 'var(--text-muted)', fontSize: 12 }}>
                {loadStateLabel(dll.load_state)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
};

// ==================== TAB: DLL ====================

const TabDll = ({ steamDir, scanData, onRefresh, show }) => {
  const [loading, setLoading] = useState(false);

  const handle = async (fn, action = 'Action') => {
    setLoading(true);
    try { await fn(); show('Done!', 'success'); onRefresh(); }
    catch (e) { toastError(show, action, e); }
    finally { setLoading(false); }
  };

  return (
    <>
      <p className="sm-section-title">Manage DLLs</p>
      <div className="sm-action-row">
        <button
          id="btn-install-dlls"
          className="sm-btn primary"
          disabled={!steamDir || loading}
          onClick={() => handle(() => api.installDlls(steamDir), 'Install DLLs')}
        >
          {loading ? <Spinner /> : null} Install DLLs
        </button>
        <button
          id="btn-remove-dlls"
          className="sm-btn danger"
          disabled={!steamDir || loading}
          onClick={() => handle(() => api.removeDlls(steamDir), 'Remove DLLs')}
        >
          {loading ? <Spinner /> : null} Remove DLLs
        </button>
        <button
          id="btn-close-steam"
          className="sm-btn"
          disabled={!steamDir || loading}
          onClick={() => handle(() => api.closeSteam(), 'Close Steam')}
        >
          Close Steam
        </button>
        <button
          id="btn-restart-steam"
          className="sm-btn"
          disabled={!steamDir || loading}
          onClick={() => handle(() => api.restartSteam(steamDir), 'Restart Steam')}
        >
          {loading ? <Spinner /> : null} Restart Steam
        </button>
      </div>

      {scanData?.missing_dll_resources?.length > 0 && (
        <div className="sm-update-card" style={{ borderColor: '#e05555' }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#e05555' }}>
            Missing bundled resources:
          </p>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {scanData.missing_dll_resources.map(r => (
              <li key={r} style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{r}</li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
};

// ==================== TAB: GAMES ====================

const TabGames = ({ steamDir, show, games, gamesLoading, refreshGames }) => {
  const { isDiscord, syncState } = useSync();
  const [restoring, setRestoring] = useState(null);
  const [selected, setSelected] = useState(() => new Set());

  // Prune selections that no longer exist after refreshes.
  useEffect(() => {
    setSelected(prev => {
      const ids = new Set(games.map(g => String(g.appid)));
      const next = new Set([...prev].filter(id => ids.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [games]);

  const selectedCount = games.filter(g => selected.has(String(g.appid))).length;
  const allSelected = games.length > 0 && selectedCount === games.length;

  const toggleSelect = (appid) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(appid)) next.delete(appid); else next.add(appid);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelected(allSelected ? new Set() : new Set(games.map(g => String(g.appid))));
  };

  const bulkSetEnabled = async (enabled) => {
    const targets = games.filter(g => selected.has(String(g.appid)));
    if (!targets.length) return;
    for (const g of targets) {
      try { await api.setGameEnabled(steamDir, g.appid, enabled); }
      catch (e) {
        toastError(show, `Failed to ${enabled ? 'enable' : 'disable'} ${g.name}`, e);
      }
    }
    setSelected(new Set());
    show(`${targets.length} game(s) ${enabled ? 'enabled' : 'disabled'}`, 'success');
    await refreshGames();
  };

  const bulkDelete = async () => {
    const targets = games.filter(g => selected.has(String(g.appid)));
    if (!targets.length) return;
    if (!confirm(`Delete ${targets.length} selected game(s)?`)) return;
    for (const g of targets) {
      try { await api.deleteGame(steamDir, g.appid); }
      catch (e) { toastError(show, `Failed to delete ${g.name}`, e); }
    }
    setSelected(new Set());
    show(`Deleted ${targets.length} game(s)`, 'success');
    await refreshGames();
  };

  const handle = async (fn, action = 'Action', successMsg = 'Done!') => {
    try { await fn(); show(successMsg, 'success'); await refreshGames(); }
    catch (e) { toastError(show, action, e); }
  };

  // Cloud snapshot games that aren't on this PC yet.
  const cloudGames = isDiscord ? (syncState?.injected_games ?? []) : [];
  const missingCloudGames = cloudGames.filter(cg =>
    !games.some(g => String(g.appid) === String(cg.app_id)),
  );

  // Cloud snapshots may store placeholder names ("App {appid}") from before
  // name resolution existed — hydrate them via the name cache / Steam Store.
  const placeholderCloudIds = useMemo(
    () =>
      missingCloudGames
        .filter(cg => /^App \d+$/.test(String(cg.game_name ?? '')))
        .map(cg => Number(cg.app_id)),
    [missingCloudGames],
  );
  const [cloudNames, setCloudNames] = useState({});
  useEffect(() => {
    if (!placeholderCloudIds.length) { setCloudNames({}); return; }
    let cancelled = false;
    api.resolveAppNames(placeholderCloudIds)
      .then(map => { if (!cancelled) setCloudNames(map); })
      .catch(() => { /* keep placeholder names on failure */ });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeholderCloudIds.join(',')]);
  const cloudGameName = (cg) => cloudNames[cg.app_id] ?? cg.game_name ?? `App ${cg.app_id}`;

  const restoreGame = async (cg) => {
    setRestoring(String(cg.app_id));
    try {
      await api.autoSaveAndImportLua(Number(cg.app_id), cloudGameName(cg), { steamDir });
      show(`Restored ${cloudGameName(cg)}!`, 'success');
      await refreshGames();
    } catch (e) {
      toastError(show, `Restore ${cloudGameName(cg)}`, e);
    }
    finally { setRestoring(null); }
  };

  const restoreAll = async () => {
    for (const cg of missingCloudGames) {
      setRestoring(String(cg.app_id));
      try {
        await api.autoSaveAndImportLua(Number(cg.app_id), cloudGameName(cg), { steamDir });
      } catch (e) {
        toastError(show, `Restore ${cloudGameName(cg)}`, e);
      }
    }
    setRestoring(null);
    show('Restore finished!', 'success');
    await refreshGames();
  };

  return (
    <>
      {isDiscord && missingCloudGames.length > 0 && (
        <div className="sm-update-card" style={{ borderColor: 'var(--led-color)' }}>
          <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, color: 'var(--text-color)' }}>
            Cloud snapshot — {missingCloudGames.length} game(s) missing on this PC:
          </p>
          <div className="sm-game-list">
            {missingCloudGames.map(cg => (
              <div key={cg.app_id} className="sm-game-row">
                <Led on={false} warn />
                <span className="sm-game-row-name">{cloudGameName(cg)}</span>
                <span className="sm-game-row-appid">#{cg.app_id}</span>
                <div className="sm-game-row-actions">
                  <button
                    className="sm-btn primary"
                    style={{ padding: '6px 10px', fontSize: 12 }}
                    disabled={restoring === String(cg.app_id) || !steamDir}
                    onClick={() => restoreGame(cg)}
                  >
                    {restoring === String(cg.app_id) ? <Spinner /> : null} Restore
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button
            className="sm-btn primary"
            style={{ marginTop: 8 }}
            disabled={!!restoring || !steamDir}
            onClick={restoreAll}
          >
            Restore All
          </button>
        </div>
      )}

      <div className="sm-action-row">
        <button id="btn-import-lua" className="sm-btn primary"
          disabled={!steamDir || gamesLoading}
          onClick={() => handle(() => api.importLuaFile(steamDir), 'Import', 'Game imported!')}
        >
          Import .lua
        </button>
        <button id="btn-open-lua-dir" className="sm-btn"
          disabled={!steamDir}
          onClick={() => handle(() => api.openLuaDir(steamDir), 'Open folder', 'Opened explorer')}
        >
          Open Folder
        </button>
        <button id="btn-refresh-games" className="sm-btn" disabled={gamesLoading} onClick={refreshGames}>
          {gamesLoading ? <Spinner /> : null} Refresh
        </button>
      </div>

      <div className="sm-action-row">
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleSelectAll}
            style={{ accentColor: 'var(--led-color)', cursor: 'pointer' }}
          />
          Select all ({games.length})
        </label>
        <button className="sm-btn" style={{ padding: '6px 10px', fontSize: 12 }}
          disabled={!selectedCount || gamesLoading}
          onClick={() => bulkSetEnabled(false)}>
          Disable Selected ({selectedCount})
        </button>
        <button className="sm-btn" style={{ padding: '6px 10px', fontSize: 12 }}
          disabled={!selectedCount || gamesLoading}
          onClick={() => bulkSetEnabled(true)}>
          Enable Selected ({selectedCount})
        </button>
        <button className="sm-btn danger" style={{ padding: '6px 10px', fontSize: 12 }}
          disabled={!selectedCount || gamesLoading}
          onClick={bulkDelete}>
          Delete Selected ({selectedCount})
        </button>
      </div>

      {gamesLoading && !games.length
        ? <p className="sm-empty"><Spinner /></p>
        : games.length === 0
          ? <p className="sm-empty">No managed games found in this Steam directory.</p>
          : (
            <div className="sm-game-list">
              {games.map(g => (
                <div key={g.appid} className="sm-game-row">
                  <input
                    type="checkbox"
                    checked={selected.has(String(g.appid))}
                    onChange={() => toggleSelect(String(g.appid))}
                    aria-label={`Select ${g.name}`}
                    style={{ accentColor: 'var(--led-color)', cursor: 'pointer', flexShrink: 0 }}
                  />
                  <Led on={g.enabled} />
                  <span className="sm-game-row-name">{g.name}</span>
                  <span className="sm-game-row-appid">#{g.appid}</span>
                  <div className="sm-game-row-actions">
                    <button
                      className="sm-btn"
                      style={{ padding: '6px 10px', fontSize: 12 }}
                      onClick={() => handle(
                        () => api.setGameEnabled(steamDir, g.appid, !g.enabled),
                        g.enabled ? 'Disable' : 'Enable',
                        g.enabled ? 'Game disabled' : 'Game enabled'
                      )}
                    >
                      {g.enabled ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      className="sm-btn danger"
                      style={{ padding: '6px 10px', fontSize: 12 }}
                      onClick={() => {
                        if (confirm(`Delete "${g.name}"?`))
                          handle(() => api.deleteGame(steamDir, g.appid), 'Delete', 'Game deleted');
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
    </>
  );
};

// ==================== TAB: LOGS ====================

const TabLogs = ({ steamDir, show }) => {
  const [logs, setLogs] = useState([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!steamDir) return;
    setLoading(true);
    try { setLogs(await api.readLogs(steamDir)); }
    catch (e) { show(String(e), 'error', 5000); }
    finally { setLoading(false); }
  }, [steamDir, show]);

  useEffect(() => { refresh(); }, [refresh]);

  if (loading) return <p className="sm-empty"><Spinner /> Loading logs…</p>;
  if (!logs.length) return (
    <div>
      <div className="sm-action-row">
        <button className="sm-btn" onClick={refresh}>Refresh</button>
      </div>
      <p className="sm-empty">No log files found.</p>
    </div>
  );

  const current = logs[active];

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div className="sm-log-tabs">
          {logs.map((l, i) => (
            <button key={l.name} className={`sm-log-tab ${i === active ? 'active' : ''}`}
              onClick={() => setActive(i)}>
              {l.name}
            </button>
          ))}
        </div>
        <button className="sm-btn" style={{ flexShrink: 0 }} onClick={refresh}>Refresh</button>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, fontSize: 12, color: 'var(--text-muted)' }}>
        <span>{current.line_count} lines</span>
        <span>·</span>
        <span>{(current.size_bytes / 1024).toFixed(1)} KB</span>
        {current.modified_time && (
          <>
            <span>·</span>
            <span>{new Date(current.modified_time * 1000).toLocaleString()}</span>
          </>
        )}
      </div>
      <div className="sm-log-content">{current.content || '(empty)'}</div>
    </>
  );
};

// ==================== TAB: SETTINGS ====================

const DEFAULT_SETTINGS = {
  log_level: 'info',
  manifest_url: 'wudrm',
  timeout_resolve_ms: 5000,
  timeout_connect_ms: 5000,
  timeout_send_ms: 10000,
  timeout_recv_ms: 10000,
  lua_paths: [],
  pattern_mirror: '',
};

const TabSettings = ({ steamDir, show }) => {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!steamDir) return;
    setLoading(true);
    api.loadSettings(steamDir)
      .then(setSettings)
      .catch(e => show(String(e), 'error', 5000))
      .finally(() => setLoading(false));
  }, [steamDir, show]);

  const set = (key, val) => setSettings(prev => ({ ...prev, [key]: val }));

  const save = async () => {
    setSaving(true);
    try { await api.saveSettings(steamDir, settings); show('Settings saved!', 'success'); }
    catch (e) { show(String(e), 'error', 5000); }
    finally { setSaving(false); }
  };

  if (loading) return <p className="sm-empty"><Spinner /></p>;

  return (
    <>
      <p className="sm-section-title">Micah_Mode Config</p>
      <div className="sm-form-grid">
        <div className="sm-field">
          <label className="sm-label">Log Level</label>
          <select id="setting-log-level" className="sm-select"
            value={settings.log_level}
            onChange={e => set('log_level', e.target.value)}>
            {['trace', 'debug', 'info', 'warn', 'error'].map(v =>
              <option key={v} value={v}>{v}</option>)}
          </select>
        </div>

        <div className="sm-field">
          <label className="sm-label">Manifest Source</label>
          <select id="setting-manifest-url" className="sm-select"
            value={settings.manifest_url}
            onChange={e => set('manifest_url', e.target.value)}>
            <option value="wudrm">wudrm</option>
            <option value="steamrun">steamrun</option>
          </select>
        </div>

        {[
          ['timeout_resolve_ms', 'Resolve Timeout (ms)'],
          ['timeout_connect_ms', 'Connect Timeout (ms)'],
          ['timeout_send_ms', 'Send Timeout (ms)'],
          ['timeout_recv_ms', 'Recv Timeout (ms)'],
        ].map(([key, label]) => (
          <div key={key} className="sm-field">
            <label className="sm-label">{label}</label>
            <input id={`setting-${key}`} className="sm-input" type="number"
              value={settings[key]}
              onChange={e => set(key, Number(e.target.value))} />
          </div>
        ))}

        <div className="sm-field sm-field-full">
          <label className="sm-label">Pattern Mirror</label>
          <input id="setting-pattern-mirror" className="sm-input"
            value={settings.pattern_mirror}
            placeholder="optional mirror URL"
            onChange={e => set('pattern_mirror', e.target.value)} />
        </div>
      </div>

      <div className="sm-action-row" style={{ marginTop: 16 }}>
        <button id="btn-save-settings" className="sm-btn primary"
          disabled={!steamDir || saving}
          onClick={save}>
          {saving ? <Spinner /> : null} Save
        </button>
      </div>
    </>
  );
};

// ==================== TAB CONTENT WRAPPER ====================
// Mounts fresh on every tab switch — GSAP fires cleanly each time.
// Light fade+slide only (no scale — avoids blurry text and layout cost).
const TabContent = ({ children }) => {
  const wrapRef = useRef(null);
  useGSAP(() => {
    if (prefersReducedMotion()) return;
    gsap.fromTo(
      wrapRef.current,
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: 0.26, ease: 'power2.out' }
    );
  }, { scope: wrapRef });
  return <div ref={wrapRef} style={{ height: '100%' }}>{children}</div>;
};

// ==================== MAIN COMPONENT ====================

const TABS = [
  { id: 'status', label: 'Status' },
  { id: 'dll', label: 'DLLs' },
  { id: 'games', label: 'Games' },
  { id: 'logs', label: 'Logs' },
  { id: 'settings', label: 'Settings' },
];

const SteamManager = ({ onBack }) => {
  const pageRef = useRef(null);
  const panelRef = useRef(null);
  const backdropRef = useRef(null);
  const headerRef = useRef(null);
  const dirRowRef = useRef(null);
  const tabsRowRef = useRef(null);

  const { updateAppSettings, updateGames } = useSync();

  const [tab, setTab] = useState('status');
  const [steamDir, setSteamDir] = useState('');
  const [scanData, setScanData] = useState(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [games, setGames] = useState([]);
  const [gamesLoading, setGamesLoading] = useState(false);
  const { toast, show } = useToast();

  // Games are fetched once per manager open (and cached server-side in
  // name_cache.json), so switching to the Games tab never re-queries.
  const refreshGames = useCallback(async () => {
    if (!steamDir) return;
    setGamesLoading(true);
    try {
      const list = await api.listGames(steamDir);
      setGames(list);
      updateGames(list);
    }
    catch (e) { show(String(e), 'error', 5000); }
    finally { setGamesLoading(false); }
  }, [steamDir, show, updateGames]);

  // Enter animation — refs used directly so no stale selectors.
  // Blur is applied statically (GPU-cheap); only opacity fades.
  useGSAP(() => {
    if (prefersReducedMotion()) return;
    gsap.set(backdropRef.current, {
      backdropFilter: 'blur(12px)',
      webkitBackdropFilter: 'blur(12px)',
    });
    const tl = gsap.timeline();
    tl.fromTo(backdropRef.current,
      { opacity: 0 },
      { opacity: 1, duration: 0.4, ease: 'power2.out' }
    );
    // Panel rise with a subtle settle — softer scale keeps text crisp.
    tl.fromTo(panelRef.current,
      { y: 56, scale: 0.98, opacity: 0 },
      { y: 0, scale: 1, opacity: 1, duration: 0.55, ease: 'back.out(1.08)' },
      '-=0.3'
    );
    // Header → dir row → tabs stagger (all via refs)
    tl.fromTo(
      [headerRef.current, dirRowRef.current, tabsRowRef.current],
      { y: -10, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.34, ease: 'power2.out', stagger: 0.08 },
      '-=0.22'
    );
  }, { scope: pageRef });

  const handleBack = () => {
    if (prefersReducedMotion()) {
      onBack();
      return;
    }
    const tl = gsap.timeline({ onComplete: onBack });
    tl.to(panelRef.current, { y: 40, scale: 0.98, opacity: 0, duration: 0.3, ease: 'power3.in' });
    tl.to(backdropRef.current, { opacity: 0, duration: 0.22, ease: 'power2.in' }, '-=0.18');
  };

  // Auto-detect steam dir on mount
  useEffect(() => {
    api.detectSteamDir()
      .then(dir => { if (dir) setSteamDir(dir); })
      .catch(() => { });
  }, []);

  // Keep the cloud snapshot's app settings in sync with the selected Steam dir
  useEffect(() => {
    if (steamDir) updateAppSettings({ steam_dir: steamDir });
  }, [steamDir, updateAppSettings]);

  const handleBrowse = async () => {
    const dir = await api.selectSteamDir().catch(() => null);
    if (dir) setSteamDir(dir);
  };

  const handleScan = useCallback(async () => {
    if (!steamDir) return;
    setScanLoading(true);
    try { setScanData(await api.scanState(steamDir)); }
    catch (e) { show(String(e), 'error', 5000); }
    finally { setScanLoading(false); }
  }, [steamDir, show]);

  // Prefetch scan + games in parallel as soon as a Steam dir is known,
  // so every tab renders instantly on first click.
  useEffect(() => {
    if (steamDir) {
      handleScan();
      refreshGames();
    }
  }, [steamDir, handleScan, refreshGames]);

  // Silent background refresh of the scan — DLL/Status data stays fresh
  // without blocking the UI or flashing the spinner.
  useEffect(() => {
    if (!steamDir) return;
    const id = setInterval(() => {
      api.scanState(steamDir).then(setScanData).catch(() => { });
    }, 10_000);
    return () => clearInterval(id);
  }, [steamDir]);

  return (
    <div ref={pageRef} className="sm-overlay">
      <div ref={backdropRef} className="sm-backdrop" />
      <div ref={panelRef} className="sm-panel">
        {/* Header */}
        <div ref={headerRef} className="sm-header">
          <div className="sm-header-left">
            <button id="sm-back-btn" className="sm-back-btn" onClick={handleBack} aria-label="Back">
              Back
            </button>
            <h1 className="sm-title">Micah0xC Manager</h1>
          </div>
          {steamDir && (
            <span className="sm-steam-dir-badge" title={steamDir}>{steamDir}</span>
          )}
        </div>

        {/* Steam Dir row */}
        <div ref={dirRowRef} style={{ padding: '12px 24px 0', flexShrink: 0 }}>
          <div className="sm-dir-row">
            <input
              id="sm-steam-dir-input"
              className="sm-dir-input"
              value={steamDir}
              onChange={e => setSteamDir(e.target.value)}
              placeholder="Steam directory path…"
            />
            <button id="sm-browse-btn" className="sm-btn" onClick={handleBrowse}>Browse</button>
            <button id="sm-scan-btn" className="sm-btn primary"
              disabled={!steamDir || scanLoading} onClick={handleScan}>
              {scanLoading ? <Spinner /> : null} Scan
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div ref={tabsRowRef} className="sm-tabs">
          {TABS.map(t => (
            <button key={t.id}
              className={`sm-tab ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Body — key={tab} forces TabContent to unmount+remount on every switch */}
        <div className="sm-body">
          <TabContent key={tab}>
            {tab === 'status' && (
              <TabStatus steamDir={steamDir} scanData={scanData}
                onRefresh={handleScan} loading={scanLoading} />
            )}
            {tab === 'dll' && (
              <TabDll steamDir={steamDir} scanData={scanData}
                onRefresh={handleScan} show={show} />
            )}
            {tab === 'games' && (
              <TabGames steamDir={steamDir} show={show}
                games={games} gamesLoading={gamesLoading} refreshGames={refreshGames} />
            )}
            {tab === 'logs' && (
              <TabLogs steamDir={steamDir} show={show} />
            )}
            {tab === 'settings' && (
              <TabSettings steamDir={steamDir} show={show} />
            )}
          </TabContent>
        </div>

        <Toast message={toast?.message} type={toast?.type} />
      </div>
    </div>
  );
};

export default SteamManager;

import React, { useState, useEffect, useRef, useCallback } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import * as api from '../api.ts';
import './SteamManager.css';

// ==================== SMALL SHARED COMPONENTS ====================

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
  if (loading) return <p className="sm-empty"><Spinner /> Scanning…</p>;
  if (!scanData) return (
    <p className="sm-empty">
      <button className="sm-btn primary" onClick={onRefresh}>Scan Now</button>
    </p>
  );

  const s = scanData;
  return (
    <>
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

  const handle = async (fn) => {
    setLoading(true);
    try { await fn(); show('Done!', 'success'); onRefresh(); }
    catch (e) { show(String(e), 'error', 5000); }
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
          onClick={() => handle(() => api.installDlls(steamDir))}
        >
          {loading ? <Spinner /> : null} Install DLLs
        </button>
        <button
          id="btn-remove-dlls"
          className="sm-btn danger"
          disabled={!steamDir || loading}
          onClick={() => handle(() => api.removeDlls(steamDir))}
        >
          {loading ? <Spinner /> : null} Remove DLLs
        </button>
        <button
          id="btn-close-steam"
          className="sm-btn"
          disabled={!steamDir || loading}
          onClick={() => handle(() => api.closeSteam())}
        >
          Close Steam
        </button>
        <button
          id="btn-restart-steam"
          className="sm-btn"
          disabled={!steamDir || loading}
          onClick={() => handle(() => api.restartSteam(steamDir))}
        >
          Restart Steam
        </button>
      </div>

      {scanData?.missing_dll_resources?.length > 0 && (
        <div className="sm-update-card" style={{ borderColor: '#e05555' }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#e05555' }}>
            ⚠ Missing bundled resources:
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

const TabGames = ({ steamDir, show }) => {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!steamDir) return;
    setLoading(true);
    try { setGames(await api.listGames(steamDir)); }
    catch (e) { show(String(e), 'error', 5000); }
    finally { setLoading(false); }
  }, [steamDir, show]);

  useEffect(() => { refresh(); }, [refresh]);

  const handle = async (fn, successMsg = 'Done!') => {
    try { await fn(); show(successMsg, 'success'); await refresh(); }
    catch (e) { show(String(e), 'error', 5000); }
  };

  return (
    <>
      <div className="sm-action-row">
        <button id="btn-import-lua" className="sm-btn primary"
          disabled={!steamDir || loading}
          onClick={() => handle(() => api.importLuaFile(steamDir), 'Game imported!')}
        >
          Import .lua
        </button>
        <button id="btn-open-lua-dir" className="sm-btn"
          disabled={!steamDir}
          onClick={() => handle(() => api.openLuaDir(steamDir), 'Opened explorer')}
        >
          Open Folder
        </button>
        <button id="btn-refresh-games" className="sm-btn" disabled={loading} onClick={refresh}>
          {loading ? <Spinner /> : null} Refresh
        </button>
      </div>

      {loading && !games.length
        ? <p className="sm-empty"><Spinner /></p>
        : games.length === 0
          ? <p className="sm-empty">No managed games found in this Steam directory.</p>
          : (
            <div className="sm-game-list">
              {games.map(g => (
                <div key={g.appid} className="sm-game-row">
                  <Led on={g.enabled} />
                  <span className="sm-game-row-name">{g.name}</span>
                  <span className="sm-game-row-appid">#{g.appid}</span>
                  <div className="sm-game-row-actions">
                    <button
                      className="sm-btn"
                      style={{ padding: '6px 10px', fontSize: 12 }}
                      onClick={() => handle(
                        () => api.setGameEnabled(steamDir, g.appid, !g.enabled),
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
                          handle(() => api.deleteGame(steamDir, g.appid), 'Game deleted');
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
      <p className="sm-section-title">OpenSteamTool Config</p>
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

// ==================== TAB: UPDATER ====================

const TabUpdater = ({ show }) => {
  const [channel, setChannel] = useState('stable');
  const [dotEnabled, setDotEnabled] = useState(false);
  const [info, setInfo] = useState(null);
  const [checking, setChecking] = useState(false);
  const [installing, setInstalling] = useState(false);

  const check = async () => {
    setChecking(true); setInfo(null);
    try { setInfo(await api.checkUpdateChannel(channel, dotEnabled)); }
    catch (e) { show(String(e), 'error', 5000); }
    finally { setChecking(false); }
  };

  const install = async () => {
    if (!confirm('Install update now? The app will restart.')) return;
    setInstalling(true);
    try { await api.installUpdateChannel(channel, dotEnabled); }
    catch (e) { show(String(e), 'error', 5000); setInstalling(false); }
  };

  return (
    <>
      <p className="sm-section-title">Update Channel</p>
      <div className="sm-action-row">
        <select id="updater-channel" className="sm-select" style={{ width: 120 }}
          value={channel} onChange={e => setChannel(e.target.value)}>
          <option value="stable">Stable</option>
          <option value="beta">Beta</option>
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)' }}>
          <input type="checkbox" checked={dotEnabled} onChange={e => setDotEnabled(e.target.checked)} />
          DOT DNS
        </label>
        <button id="btn-check-update" className="sm-btn primary"
          disabled={checking} onClick={check}>
          {checking ? <Spinner /> : null} Check
        </button>
      </div>

      {info && (
        <div className={`sm-update-card ${info.available ? 'sm-update-available' : ''}`}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ margin: '0 0 2px', fontSize: 12, color: 'var(--text-muted)', fontWeight: 700 }}>
                {info.available ? 'Update Available' : 'Up to date'}
              </p>
              <span className="sm-update-version">{info.version}</span>
            </div>
            <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--text-muted)' }}>
              <p style={{ margin: 0 }}>Current: <strong>{info.current_version}</strong></p>
              {info.date && <p style={{ margin: 0 }}>{new Date(info.date).toLocaleDateString()}</p>}
            </div>
          </div>
          {info.body && <div className="sm-update-body">{info.body}</div>}
          {info.available && (
            <button id="btn-install-update" className="sm-btn primary"
              disabled={installing} onClick={install}>
              {installing ? <Spinner /> : null} Install Update
            </button>
          )}
        </div>
      )}
    </>
  );
};

// ==================== TAB CONTENT WRAPPER ====================
// Mounts fresh on every tab switch — GSAP fires cleanly each time
const TabContent = ({ children }) => {
  const wrapRef = useRef(null);
  useGSAP(() => {
    gsap.fromTo(
      wrapRef.current,
      { opacity: 0, y: 24, scale: 0.97 },
      { opacity: 1, y: 0, scale: 1, duration: 0.38, ease: 'power3.out' }
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
  { id: 'updater', label: 'Updater' },
];

const SteamManager = ({ onBack }) => {
  const pageRef = useRef(null);
  const panelRef = useRef(null);
  const backdropRef = useRef(null);
  const headerRef = useRef(null);
  const dirRowRef = useRef(null);
  const tabsRowRef = useRef(null);

  const [tab, setTab] = useState('status');
  const [steamDir, setSteamDir] = useState('');
  const [scanData, setScanData] = useState(null);
  const [scanLoading, setScanLoading] = useState(false);
  const { toast, show } = useToast();

  // Enter animation — refs used directly so no stale selectors
  useGSAP(() => {
    const tl = gsap.timeline();
    // Backdrop blur-in
    tl.fromTo(backdropRef.current,
      { opacity: 0, backdropFilter: 'blur(0px)', webkitBackdropFilter: 'blur(0px)' },
      { opacity: 1, backdropFilter: 'blur(12px)', webkitBackdropFilter: 'blur(12px)', duration: 0.5, ease: 'power2.out' }
    );
    // Panel bounce-up
    tl.fromTo(panelRef.current,
      { y: 80, scale: 0.95, opacity: 0 },
      { y: 0, scale: 1, opacity: 1, duration: 0.6, ease: 'back.out(1.15)' },
      '-=0.35'
    );
    // Header → dir row → tabs stagger (all via refs)
    tl.fromTo(
      [headerRef.current, dirRowRef.current, tabsRowRef.current],
      { y: -12, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.38, ease: 'power2.out', stagger: 0.09 },
      '-=0.25'
    );
  }, { scope: pageRef });

  const handleBack = () => {
    const tl = gsap.timeline({ onComplete: onBack });
    tl.to(panelRef.current, { y: 60, scale: 0.96, opacity: 0, duration: 0.35, ease: 'power3.in' });
    tl.to(backdropRef.current, {
      opacity: 0,
      backdropFilter: 'blur(0px)',
      webkitBackdropFilter: 'blur(0px)',
      duration: 0.25,
      ease: 'power2.in'
    }, '-=0.2');
  };

  // Auto-detect steam dir on mount
  useEffect(() => {
    api.detectSteamDir()
      .then(dir => { if (dir) setSteamDir(dir); })
      .catch(() => { });
  }, []);

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

  // Auto-scan when steam dir changes
  useEffect(() => {
    if (steamDir) handleScan();
  }, [steamDir, handleScan]);

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
              <TabGames steamDir={steamDir} show={show} />
            )}
            {tab === 'logs' && (
              <TabLogs steamDir={steamDir} show={show} />
            )}
            {tab === 'settings' && (
              <TabSettings steamDir={steamDir} show={show} />
            )}
            {tab === 'updater' && (
              <TabUpdater show={show} />
            )}
          </TabContent>
        </div>

        <Toast message={toast?.message} type={toast?.type} />
      </div>
    </div>
  );
};

export default SteamManager;

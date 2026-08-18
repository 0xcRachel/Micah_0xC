import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { useSync } from '../sync/SyncProvider';
import * as api from '../api.ts';

const Toggle = ({ settingKey, defaultOn = false, checked, onChange, id }) => {
  const saved = localStorage.getItem(`setting_${settingKey}`);
  const initial = saved !== null ? saved === 'true' : defaultOn;
  const [localOn, setLocalOn] = React.useState(initial);

  const isControlled = checked !== undefined;
  const on = isControlled ? checked : localOn;

  const handleToggle = (e) => {
    if (isControlled) {
      if (onChange) onChange(!on, e);
    } else {
      const next = !on;
      setLocalOn(next);
      localStorage.setItem(`setting_${settingKey}`, String(next));
    }
  };

  return (
    <button
      id={id}
      onClick={handleToggle}
      className={`relative w-11 h-6 rounded-full transition-colors duration-300 cursor-pointer flex-shrink-0
        ${on ? 'bg-[var(--led-color)]' : 'bg-[var(--text-muted)]/40'}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-300
          ${on ? 'translate-x-5' : 'translate-x-0'}`}
      />
    </button>
  );
};

const SettingRow = ({ label, description, children }) => (
  <div className="flex items-center justify-between bg-[var(--card-bg-alt)] rounded-2xl px-4 py-3 border border-[var(--card-border)]/10">
    <div>
      <p className="text-sm font-semibold text-[var(--text-color)]">{label}</p>
      {description && <p className="text-xs text-[var(--text-muted)] mt-0.5">{description}</p>}
    </div>
    {children}
  </div>
);

const DISCORD_BLURPLE = '#5865F2';

const DiscordMark = ({ className = 'w-5 h-5', color = DISCORD_BLURPLE }) => (
  <svg viewBox="0 0 24 24" fill={color} className={className} aria-hidden="true">
    <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
  </svg>
);

const SyncStatusChip = ({ status, error }) => {
  const map = {
    idle: { label: 'Idle', color: 'var(--text-muted)' },
    syncing: { label: 'Syncing…', color: '#e0b33c' },
    synced: { label: 'Synced', color: 'var(--led-color, #4d9e6a)' },
    error: { label: 'Sync error', color: '#e05555' },
  };
  const s = map[status] ?? map.idle;
  return (
    <span
      title={error ? `Sync error: ${error}` : `Sync: ${status}`}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold
        bg-[var(--card-bg)] border border-[var(--card-border)]/10 whitespace-nowrap"
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />
      {s.label}
    </span>
  );
};

const TinySpinner = () => (
  <span className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin shrink-0" />
);

const SettingsPage = ({
  onBack,
  isDarkMode,
  onToggleDarkMode,
  animationsEnabled,
  onToggleAnimations
}) => {
  const pageRef = useRef(null);
  const contentRef = useRef(null);

  const {
    profile,
    isDiscord,
    isGuest,
    booting,
    loginState,
    loginError,
    login,
    logout,
    syncState,
    syncStatus,
    syncError,
    pushNow,
    pullNow,
    supabaseConfigured,
  } = useSync();

  const [busy, setBusy] = useState(false);

  // Start on Boot + Remember Window (controlled by the Rust side)
  const [autoBootOn, setAutoBootOn] = useState(false);
  const [rememberWindowOn, setRememberWindowOn] = useState(true);

  useEffect(() => {
    api.isAutostartEnabled().then(setAutoBootOn).catch(() => {});
    api.getWindowRemember().then(setRememberWindowOn).catch(() => {});
  }, []);

  const handleAutoBoot = async (next) => {
    setAutoBootOn(next);
    try { await api.setAutostartEnabled(next); }
    catch { setAutoBootOn(!next); }
  };

  const handleRememberWindow = async (next) => {
    setRememberWindowOn(next);
    try { await api.setWindowRemember(next); }
    catch { setRememberWindowOn(!next); }
  };

  const handleLogin = async () => {
    setBusy(true);
    try { await login(); } finally { setBusy(false); }
  };

  const handleLogout = async () => {
    setBusy(true);
    try { await logout(); } finally { setBusy(false); }
  };

  const handleSync = async () => {
    setBusy(true);
    try { await pushNow(); } finally { setBusy(false); }
  };

  const handleRestore = async () => {
    setBusy(true);
    try { await pullNow(); } finally { setBusy(false); }
  };

  const lastSynced = syncState?.last_synced_at
    ? new Date(syncState.last_synced_at).toLocaleString()
    : null;

  // Enter animation: slide in from the right
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.fromTo(pageRef.current,
      { opacity: 0 },
      { opacity: 1, duration: 0.3, ease: 'power2.out' }
    );
    tl.fromTo(contentRef.current,
      { x: 80, opacity: 0 },
      { x: 0, opacity: 1, duration: 0.45, ease: 'power3.out' },
      '-=0.1'
    );
  }, { scope: pageRef });

  const handleBack = () => {
    const tl = gsap.timeline({ onComplete: onBack });
    tl.to(contentRef.current, { x: 80, opacity: 0, duration: 0.3, ease: 'power2.in' });
    tl.to(pageRef.current, { opacity: 0, duration: 0.2, ease: 'power2.in' }, '-=0.15');
  };

  return (
    <div
      ref={pageRef}
      className="fixed inset-0 z-40 flex items-center justify-center"
    >
      {/* Blurred background */}
      <div className="absolute inset-0 bg-[var(--bg-color)]/85 backdrop-blur-md" />

      {/* Page Content */}
      <div
        ref={contentRef}
        className="relative z-10 w-full max-w-md mx-4"
      >
        {/* Back Button */}
        <button
          onClick={handleBack}
          className="mb-6 flex items-center gap-2 text-sm font-semibold text-[var(--text-muted)] 
            hover:text-[var(--text-color)] transition-colors duration-200 cursor-pointer group"
        >
          <span className="inline-block transition-transform duration-200 group-hover:-translate-x-1">←</span>
          Back
        </button>

        {/* Card */}
        <div
          className="bg-[var(--card-bg)] border-2 border-[var(--card-border)] rounded-3xl p-8 shadow-2xl overflow-y-auto max-h-[75vh] no-scrollbar"
          style={{ boxShadow: '0 24px 64px rgba(0,0,0,var(--shadow-opacity))' }}
        >
          <h1 className="text-2xl font-black text-[var(--text-color)] tracking-wider uppercase mb-8">Settings</h1>

          <div className="space-y-6">
            {/* Account & Cloud Sync */}
            <section>
              <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] mb-3">
                Account &amp; Cloud Sync
              </p>

              <div className="rounded-2xl border border-[var(--card-border)]/10 overflow-hidden">
                {/* Header strip */}
                <div className="flex items-center gap-2.5 px-4 py-3 bg-[var(--card-bg-alt)] border-b border-[var(--card-border)]/10">
                  <span className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: 'rgba(88, 101, 242, 0.15)' }}>
                    <DiscordMark className="w-[18px] h-[18px]" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold leading-tight text-[var(--text-color)]">Discord</p>
                    <p className="text-[11px] leading-tight text-[var(--text-muted)]">Backup &amp; cloud sync</p>
                  </div>
                  <div className="ml-auto">{!booting && <SyncStatusChip status={syncStatus} error={syncError} />}</div>
                </div>

                {/* Booting */}
                {booting && (
                  <div className="px-4 py-4 flex items-center gap-3">
                    <span className="w-10 h-10 rounded-full bg-[var(--text-muted)]/10 flex items-center justify-center shrink-0">
                      <span className="w-4 h-4 rounded-full border-2 border-[var(--text-muted)] border-t-transparent animate-spin" />
                    </span>
                    <div>
                      <p className="text-sm font-bold text-[var(--text-color)]">Restoring session…</p>
                      <p className="text-[11px] text-[var(--text-muted)]">Checking your Discord connection</p>
                    </div>
                  </div>
                )}

                {/* Guest */}
                {!booting && isGuest && (
                  <div className="px-4 py-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="w-10 h-10 rounded-full bg-[var(--text-muted)]/10 flex items-center justify-center shrink-0">
                        <DiscordMark className="w-5 h-5" color="var(--text-muted)" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[var(--text-color)]">Guest Mode</p>
                        <p className="text-[11px] text-[var(--text-muted)]">Local only — nothing is uploaded to the cloud.</p>
                      </div>
                      <button
                        onClick={handleLogin}
                        disabled={busy || loginState === 'waiting' || !supabaseConfigured}
                        className="ml-auto inline-flex items-center gap-1.5 px-3.5 h-8 rounded-full text-xs font-bold text-white cursor-pointer
                          bg-[#5865F2] hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed
                          transition-all duration-200 whitespace-nowrap"
                        title={supabaseConfigured ? 'Back up & sync your setup with Discord' : 'Supabase not configured'}
                      >
                        {busy || loginState === 'waiting' ? (
                          <>
                            <TinySpinner />
                            <span>Waiting…</span>
                          </>
                        ) : loginState === 'error' ? (
                          'Retry'
                        ) : (
                          'Connect with Discord'
                        )}
                      </button>
                    </div>
                    {loginError && (
                      <p className="text-xs text-[#e05555]">{loginError}</p>
                    )}
                  </div>
                )}

                {/* Connected */}
                {!booting && isDiscord && (
                  <div className="px-4 py-4 space-y-3">
                    <div className="flex items-center gap-3">
                      {profile?.avatarUrl ? (
                        <img
                          src={profile.avatarUrl}
                          alt={profile?.displayName ?? 'avatar'}
                          className="w-10 h-10 rounded-full object-cover shrink-0"
                        />
                      ) : (
                        <span className="w-10 h-10 rounded-full bg-[#5865F2] text-white flex items-center justify-center text-base font-black shrink-0">
                          {(profile?.displayName ?? '?').charAt(0).toUpperCase()}
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[var(--text-color)] truncate">
                          {profile?.displayName ?? 'Discord User'}
                        </p>
                        <p className="text-[11px] text-[var(--text-muted)] font-mono">
                          ID: {profile?.discordId ?? '—'}
                        </p>
                      </div>
                      <button
                        onClick={handleLogout}
                        disabled={busy}
                        className="ml-auto px-2.5 h-8 rounded-full text-[11px] font-bold text-[var(--text-muted)] cursor-pointer
                          hover:text-white hover:bg-rose-700 disabled:opacity-50 transition-colors duration-200 whitespace-nowrap"
                        title="Sign out — back to Guest mode"
                      >
                        Sign out
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-xl bg-[var(--card-bg)] border border-[var(--card-border)]/10 px-3 py-2 min-w-0">
                        <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-bold">Cloud snapshot</p>
                        <p className="text-sm font-black text-[var(--text-color)]">
                          {syncState?.injected_games?.length ?? 0} game{((syncState?.injected_games?.length ?? 0) === 1) ? '' : 's'}
                        </p>
                      </div>
                      <div className="rounded-xl bg-[var(--card-bg)] border border-[var(--card-border)]/10 px-3 py-2 min-w-0">
                        <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-bold">Last sync</p>
                        <p className="text-sm font-black text-[var(--text-color)] truncate">
                          {lastSynced ?? 'never'}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={handleSync}
                        disabled={busy}
                        className="flex-1 px-3 h-8 rounded-full text-[11px] font-bold text-[var(--on-led)] cursor-pointer
                          bg-[var(--led-color)] hover:brightness-110 disabled:opacity-50
                          transition-all duration-200"
                        title="Push your setup to the cloud now"
                      >
                        {busy ? <TinySpinner /> : null} Sync Now
                      </button>
                      <button
                        onClick={handleRestore}
                        disabled={busy}
                        className="flex-1 px-3 h-8 rounded-full text-[11px] font-bold text-[var(--text-color)] cursor-pointer
                          border border-[var(--card-border)]/30 hover:bg-[var(--led-color)] hover:text-[var(--on-led)] hover:border-transparent
                          disabled:opacity-50 transition-all duration-200"
                        title="Pull the latest cloud snapshot to this PC"
                      >
                        Pull Cloud
                      </button>
                    </div>

                    {syncError && (
                      <p className="text-xs text-[#e05555]">{syncError}</p>
                    )}
                  </div>
                )}
              </div>
            </section>

            {/* Appearance */}
            <section>
              <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] mb-3">Appearance</p>
              <div className="space-y-3">
                <SettingRow label="Dark Mode" description="Use dark background theme">
                  <Toggle
                    id="dark-mode-toggle"
                    settingKey="darkMode"
                    checked={isDarkMode}
                    onChange={onToggleDarkMode}
                  />
                </SettingRow>
                <SettingRow label="Animations" description="Enable UI animations">
                  <Toggle
                    id="animations-toggle"
                    settingKey="animations"
                    checked={animationsEnabled}
                    onChange={onToggleAnimations}
                  />
                </SettingRow>
              </div>
            </section>

            {/* Character */}
            <section>
              <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] mb-3">Character</p>
              <div className="space-y-3">
                <SettingRow label="Show Character" description="Display character on home screen">
                  <Toggle settingKey="showCharacter" defaultOn />
                </SettingRow>
                <SettingRow label="Drop Shadow" description="Character drop shadow effect">
                  <Toggle settingKey="charShadow" defaultOn />
                </SettingRow>
              </div>
            </section>

            {/* App */}
            <section>
              <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] mb-3">App</p>
              <div className="space-y-3">
                <SettingRow label="Start on Boot" description="Launch app when system starts">
                  <Toggle
                    id="start-boot-toggle"
                    checked={autoBootOn}
                    onChange={handleAutoBoot}
                  />
                </SettingRow>
                <SettingRow label="Remember Window" description="Restore window size & position on launch">
                  <Toggle
                    id="remember-window-toggle"
                    checked={rememberWindowOn}
                    onChange={handleRememberWindow}
                  />
                </SettingRow>
              </div>
            </section>
          </div>

          <p className="text-center text-xs text-[var(--text-muted)] mt-8 font-mono">v1.0.0</p>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;

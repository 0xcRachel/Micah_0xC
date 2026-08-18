import React, { useState } from 'react';
import { useSync } from '../sync/SyncProvider';

const SyncDot = () => {
  const { syncStatus, syncError } = useSync();
  const color =
    syncStatus === 'syncing'
      ? '#e0b33c'
      : syncStatus === 'error'
        ? '#e05555'
        : syncStatus === 'synced'
          ? 'var(--led-color, #4d9e6a)'
          : 'var(--text-muted, #87867f)';
  return (
    <span
      title={syncError ? `Sync error: ${syncError}` : `Sync: ${syncStatus}`}
      className="inline-block w-2 h-2 rounded-full shrink-0"
      style={{ background: color }}
    />
  );
};

const Spinner = () => (
  <span className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin shrink-0" />
);

/**
 * Floating auth badge.
 *  - Guest mode: "Guest Mode (Local Only)" + "Sync with Discord" upgrade button.
 *  - Discord mode: avatar + username + sync status + sign out.
 *
 * Both modes share one fixed-height pill; switching between them (login /
 * sign out / boot) morphs the inner content with a fade-slide animation so
 * the badge never jumps or reflows.
 */
const AuthBadge = () => {
  const {
    booting,
    profile,
    isDiscord,
    isGuest,
    loginState,
    loginError,
    login,
    logout,
    syncState,
    pushNow,
    supabaseConfigured,
  } = useSync();

  const [busy, setBusy] = useState(false);

  const handleLogin = async () => {
    setBusy(true);
    try {
      await login();
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    setBusy(true);
    try {
      await logout();
    } finally {
      setBusy(false);
    }
  };

  const handleSyncNow = async () => {
    setBusy(true);
    try {
      await pushNow();
    } catch {
      /* toast handled by caller if needed */
    } finally {
      setBusy(false);
    }
  };

  const lastSynced = syncState?.last_synced_at
    ? new Date(syncState.last_synced_at).toLocaleString()
    : null;

  const mode = booting ? 'booting' : isGuest ? 'guest' : 'user';
  const loginPending = loginState === 'opening' || loginState === 'waiting' || busy;

  return (
    <div
      className={`fixed top-4 right-4 z-50 flex items-center gap-2 h-9 rounded-full border shadow-lg
        backdrop-blur-md transition-colors duration-300
        ${loginError
          ? 'border-rose-600/50'
          : 'border-[var(--card-border)]/20'}
        bg-[var(--card-bg)]/85 px-3`}
      title={loginError ? `Login failed: ${loginError}` : undefined}
    >
      <div key={mode} className="sm-badge-fade flex items-center gap-2 min-w-0">
        {mode === 'booting' && (
          <>
            <Spinner />
            <span className="text-xs font-semibold text-[var(--text-muted)]">
              Session…
            </span>
          </>
        )}

        {mode === 'guest' && (
          <>
            <span className="text-xs font-bold tracking-wide text-[var(--text-color)] whitespace-nowrap">
              Guest Mode
            </span>
            <span className="hidden sm:inline text-[10px] font-medium text-[var(--text-muted)] whitespace-nowrap">
              (Local Only)
            </span>
            <button
              onClick={handleLogin}
              disabled={loginPending || !supabaseConfigured}
              className="ml-1 inline-flex items-center justify-center gap-1.5 h-6 px-3 min-w-[122px] rounded-full
                text-[11px] font-bold text-[var(--on-led)] cursor-pointer
                bg-[var(--led-color)] hover:brightness-110
                disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              title={
                supabaseConfigured
                  ? 'Back up & sync your setup with Discord'
                  : 'Supabase not configured'
              }
            >
              {loginPending ? (
                <>
                  <Spinner />
                  <span>Waiting…</span>
                </>
              ) : loginState === 'error' ? (
                'Retry'
              ) : (
                'Sync with Discord'
              )}
            </button>
          </>
        )}

        {mode === 'user' && (
          <>
            {profile?.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt={profile?.displayName ?? 'avatar'}
                className="w-6 h-6 rounded-full object-cover shrink-0"
              />
            ) : (
              <span className="w-6 h-6 rounded-full bg-[var(--led-color)] text-[var(--on-led)] flex items-center justify-center text-[11px] font-black shrink-0">
                {(profile?.displayName ?? '?').charAt(0).toUpperCase()}
              </span>
            )}
            <span className="text-xs font-bold text-[var(--text-color)] max-w-[110px] truncate">
              {profile?.displayName ?? 'Discord User'}
            </span>
            <span className="hidden sm:inline text-[10px] text-[var(--text-muted)] whitespace-nowrap">
              {lastSynced ? `synced ${lastSynced}` : 'not synced yet'}
            </span>
            <SyncDot />
            <button
              onClick={handleSyncNow}
              disabled={busy}
              className="inline-flex items-center gap-1 px-2 h-6 rounded-full text-[11px] font-bold text-[var(--text-color)]
                hover:bg-[var(--led-color)] hover:text-[var(--on-led)] disabled:opacity-50
                transition-colors duration-200 cursor-pointer whitespace-nowrap"
              title="Sync now"
            >
              {busy ? <Spinner /> : null}
              Sync Now
            </button>
            <button
              onClick={handleLogout}
              disabled={busy}
              className="px-2 h-6 rounded-full text-[11px] font-bold text-[var(--text-muted)]
                hover:text-white hover:bg-rose-700 disabled:opacity-50 transition-colors duration-200 cursor-pointer whitespace-nowrap"
              title="Sign out — back to Guest mode"
            >
              Sign out
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default AuthBadge;
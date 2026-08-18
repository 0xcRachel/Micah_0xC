import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  register as registerDeepLink,
  onOpenUrl,
  getCurrent,
} from '@tauri-apps/plugin-deep-link';
import { listen } from '@tauri-apps/api/event';
import * as api from '../api.ts';
import {
  supabase,
  isSupabaseConfigured,
  loginWithDiscord,
  handleAuthCallbackUrl,
  buildProfile,
  getSession,
  onAuthStateChange,
  signOut,
  AUTH_REDIRECT_URL,
  AUTH_LOCALHOST_REDIRECT_URL,
} from '../services/authService';
import {
  loadLocalSyncState,
  saveLocalSyncState,
  mergeGameSnapshots,
  mergeCloudAndLocal,
  pushSnapshot,
  pullSnapshot,
} from './syncEngine';

const SyncContext = createContext(null);

/** Local OAuth callback server (see src-tauri/src/oauth.rs). */
const OAUTH_LISTENER_PORT = 17375;
const OAUTH_LISTENER_TIMEOUT_SECS = 90;

const isTauri = () =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export const useSync = () => useContext(SyncContext);

/**
 * Global provider for the dual-auth system:
 *  - guest mode (local only) vs Discord (Supabase Auth, Discord OAuth provider)
 *  - cloud sync engine that pushes/pulls the user's snapshot per Discord user
 */
export const SyncProvider = ({ children }) => {
  const [session, setSession] = useState(null); // Supabase session | null = guest
  const [profile, setProfile] = useState(null);
  const [booting, setBooting] = useState(true);
  const [loginState, setLoginState] = useState('idle'); // idle | opening | waiting | error
  const [loginError, setLoginError] = useState(null);
  const [syncState, setSyncState] = useState(() => loadLocalSyncState());
  const [syncStatus, setSyncStatus] = useState('idle'); // idle | syncing | synced | error
  const [syncError, setSyncError] = useState(null);

  const pushTimer = useRef(null);
  const pulledForUserId = useRef(null);

  const isDiscord = Boolean(session?.user?.id);
  const isGuest = !booting && !isDiscord;

  const applySession = useCallback((nextSession) => {
    setSession(nextSession);
    setProfile(nextSession ? buildProfile(nextSession) : null);
  }, []);

  // ---------------------------------------------------------------
  // Deep link + auth listener (mounted once)
  // ---------------------------------------------------------------
  useEffect(() => {
    let unlisten = null;

    (async () => {
      if (isTauri()) {
        try {
          await registerDeepLink('micah0xc');
          unlisten = await onOpenUrl((urls) => {
            const url = urls?.[0];
            if (!url) return;
            setLoginState('waiting');
            handleAuthCallbackUrl(url)
              .then(() => setLoginState('idle'))
              .catch((err) => {
                setLoginError(String(err?.message ?? err));
                setLoginState('error');
              });
          });

          // Cold start: the app may have been LAUNCHED by the deep link
          // (event fired during setup, before the webview loaded). Poll the
          // plugin's stored "current" URL instead.
          const current = await getCurrent();
          const initialUrl = current?.[0];
          if (initialUrl) {
            setLoginState('waiting');
            handleAuthCallbackUrl(initialUrl)
              .then(() => setLoginState('idle'))
              .catch((err) => {
                setLoginError(String(err?.message ?? err));
                setLoginState('error');
              });
          }
        } catch (err) {
          console.warn('[sync] deep link unavailable:', err);
        }
      }

      if (supabase) {
        onAuthStateChange((event, nextSession) => {
          if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') {
            if (nextSession) applySession(nextSession);
          } else if (event === 'SIGNED_OUT') {
            applySession(null);
          }
        });
      }

      // Restore stored session (from OS keyring).
      const restored = await getSession();
      if (restored) applySession(restored);
      setBooting(false);
    })();

    return () => {
      if (typeof unlisten === 'function') unlisten();
      if (pushTimer.current) clearTimeout(pushTimer.current);
    };
  }, [applySession]);

  // ---------------------------------------------------------------
  // On sign-in: pull the cloud snapshot once per user so a fresh PC
  // automatically restores the backed-up setup. If the cloud already has
  // data, it is union-merged with whatever was captured locally while
  // signed out (games/app settings are never dropped), then pushed back.
  // ---------------------------------------------------------------
  const ensureLocalGames = useCallback(async () => {
    const local = loadLocalSyncState();
    if ((local.injected_games ?? []).length > 0) return local;
    try {
      const dir = await api.detectSteamDir();
      if (dir) {
        const games = await api.listGames(dir);
        return {
          ...local,
          injected_games: mergeGameSnapshots(local.injected_games, games),
        };
      }
    } catch (err) {
      console.warn('[sync] failed to seed local games:', err);
    }
    return local;
  }, []);

  useEffect(() => {
    if (!isDiscord || !supabase) return;
    const userId = session.user.id;
    if (pulledForUserId.current === userId) return;
    pulledForUserId.current = userId;

    setSyncStatus('syncing');
    ensureLocalGames()
      .then((local) =>
        pullSnapshot(session).then((cloud) => ({ cloud, local })),
      )
      .then(({ cloud, local }) => {
        if (cloud) {
          const merged = mergeCloudAndLocal(cloud, local);
          setSyncState(merged);
          return pushSnapshot(session, merged);
        }
        // First time on this account — push the local snapshot up.
        return pushSnapshot(session, local);
      })
      .then((snap) => {
        setSyncState(snap);
        setSyncStatus('synced');
      })
      .catch((err) => {
        setSyncError(String(err?.message ?? err));
        setSyncStatus('error');
      });
  }, [isDiscord, session, ensureLocalGames]);

  // ---------------------------------------------------------------
  // Auth actions
  // ---------------------------------------------------------------
  const login = useCallback(async () => {
    setLoginError(null);
    setLoginState('opening');
    try {
      // Bind the localhost callback server BEFORE opening the browser, so the
      // OAuth redirect lands on a real page ("Signed in — close this tab")
      // instead of leaving the browser tab stuck on Discord's loading screen.
      let useLocalCallback = false;
      try {
        await api.startOauthCallbackListener(
          OAUTH_LISTENER_PORT,
          OAUTH_LISTENER_TIMEOUT_SECS,
        );
        useLocalCallback = true;
      } catch (err) {
        // Port busy (e.g. a previous listener still timing out) — fall back
        // to the micah0xc:// deep link flow, handled by the onOpenUrl hook.
        console.warn('[sync] oauth listener unavailable, using deep link:', err);
      }

      const url = await loginWithDiscord(
        useLocalCallback ? AUTH_LOCALHOST_REDIRECT_URL : AUTH_REDIRECT_URL,
      );
      await api.openInBrowser(url);
      setLoginState('waiting');

      if (useLocalCallback) {
        // Resolves when the browser hits the localhost callback page.
        const callback = await new Promise((resolve) => {
          let unlisten = null;
          const fallbackTimer = setTimeout(() => {
            if (unlisten) unlisten();
            resolve({ error: 'timeout' });
          }, (OAUTH_LISTENER_TIMEOUT_SECS + 10) * 1000);
          listen('oauth://callback', (event) => {
            clearTimeout(fallbackTimer);
            if (unlisten) unlisten();
            resolve(event.payload ?? {});
          }).then((fn) => {
            unlisten = fn;
          });
        });

        if (callback?.error) {
          throw new Error(
            callback.error === 'timeout'
              ? 'Login timed out — please try again.'
              : `Authorization failed: ${callback.error}`,
          );
        }
        if (!callback?.code) {
          throw new Error('Login timed out — please try again.');
        }
        await handleAuthCallbackUrl(
          `${AUTH_LOCALHOST_REDIRECT_URL}?code=${callback.code}`,
        );
        setLoginState('idle');
        return;
      }
      // Deep-link fallback: the onOpenUrl hook completes the exchange and
      // flips loginState itself.
    } catch (err) {
      setLoginError(String(err?.message ?? err));
      setLoginState('error');
    }
  }, []);

  const logout = useCallback(async () => {
    await signOut();
    applySession(null);
  }, [applySession]);

  // ---------------------------------------------------------------
  // Sync actions
  // ---------------------------------------------------------------
  const schedulePush = useCallback(
    (next) => {
      // Always reflect the update locally (and persist it) so data captured
      // while signed out as guest survives — it gets pushed on the next
      // sign-in instead of being silently dropped.
      setSyncState(next);
      saveLocalSyncState(next);
      if (!isDiscord || !supabase) return;
      if (pushTimer.current) clearTimeout(pushTimer.current);
      pushTimer.current = setTimeout(() => {
        setSyncStatus('syncing');
        pushSnapshot(session, next)
          .then((snap) => {
            setSyncState(snap);
            setSyncStatus('synced');
          })
          .catch((err) => {
            setSyncError(String(err?.message ?? err));
            setSyncStatus('error');
          });
      }, 1500);
    },
    [isDiscord, session],
  );

  /** Called by SteamManager whenever the managed game list on disk changes. */
  const updateGames = useCallback(
    (games) => {
      const current = loadLocalSyncState();
      const injectedGames = mergeGameSnapshots(current.injected_games, games);
      schedulePush({ ...current, injected_games: injectedGames });
    },
    [schedulePush],
  );

  /** Called by Settings / theme toggles to sync app-level preferences. */
  const updateAppSettings = useCallback(
    (partial) => {
      const current = loadLocalSyncState();
      const appSettings = { ...current.app_settings, ...partial };
      schedulePush({ ...current, app_settings: appSettings });
    },
    [schedulePush],
  );

  const pushNow = useCallback(async () => {
    if (!isDiscord || !supabase) throw new Error('Sign in with Discord to sync.');
    setSyncStatus('syncing');
    try {
      const snap = await pushSnapshot(session);
      setSyncState(snap);
      setSyncStatus('synced');
      return snap;
    } catch (err) {
      setSyncError(String(err?.message ?? err));
      setSyncStatus('error');
      throw err;
    }
  }, [isDiscord, session]);

  const pullNow = useCallback(async () => {
    if (!isDiscord || !supabase) throw new Error('Sign in with Discord to sync.');
    setSyncStatus('syncing');
    try {
      const snap = await pullSnapshot(session);
      setSyncState(snap);
      setSyncStatus('synced');
      return snap;
    } catch (err) {
      setSyncError(String(err?.message ?? err));
      setSyncStatus('error');
      throw err;
    }
  }, [isDiscord, session]);

  const value = useMemo(
    () => ({
      booting,
      isTauri: isTauri(),
      supabaseConfigured: isSupabaseConfigured,
      // auth
      session,
      profile,
      isDiscord,
      isGuest,
      loginState,
      loginError,
      login,
      logout,
      // sync
      syncState,
      syncStatus,
      syncError,
      updateGames,
      updateAppSettings,
      pushNow,
      pullNow,
    }),
    [
      booting,
      session,
      profile,
      isDiscord,
      isGuest,
      loginState,
      loginError,
      login,
      logout,
      syncState,
      syncStatus,
      syncError,
      updateGames,
      updateAppSettings,
      pushNow,
      pullNow,
    ],
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
};

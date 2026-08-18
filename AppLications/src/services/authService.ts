import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { invoke } from '@tauri-apps/api/core';

/**
 * Async storage adapter backed by the OS keyring (via the Rust `auth_*`
 * commands in src-tauri/src/auth.rs). Supabase writes the session JSON here
 * instead of localStorage so the JWT never lives in plain text on disk.
 */
const keyringStorage = {
  async getItem(): Promise<string | null> {
    try {
      return await invoke<string | null>('auth_load_session');
    } catch (err) {
      console.error('[auth] load session failed:', err);
      return null;
    }
  },
  async setItem(_key: string, value: string): Promise<void> {
    try {
      await invoke('auth_store_session', { sessionJson: value });
    } catch (err) {
      console.error('[auth] store session failed:', err);
    }
  },
  async removeItem(): Promise<void> {
    try {
      await invoke('auth_clear_session');
    } catch (err) {
      console.error('[auth] clear session failed:', err);
    }
  },
};

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

/** Deep link scheme registered with the OS — used as the OAuth redirect target. */
export const AUTH_REDIRECT_URL = 'micah0xc://auth/callback';

/**
 * Localhost callback used as the primary OAuth redirect target. The browser
 * loads a real "Signed in" page (which closes itself) instead of hanging on
 * Discord's "Redirecting…" screen. Must be allowlisted in Supabase → Auth →
 * URL Configuration → Additional Redirect URLs.
 */
export const AUTH_LOCALHOST_REDIRECT_URL = 'http://127.0.0.1:17375/auth/callback';

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        flowType: 'pkce',
        storage: keyringStorage,
      },
    })
  : null;

/** Display profile derived from a Supabase session. */
export interface DiscordProfile {
  discordId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  email: string | null;
}

/**
 * Kick off Discord OAuth in the system browser.
 * Returns the authorization URL that the caller should open (e.g. via the
 * shell plugin), since `skipBrowserRedirect` keeps control in our hands and
 * the result comes back through the redirect target (localhost callback or
 * the `micah0xc://auth/callback` deep link).
 */
export async function loginWithDiscord(
  redirectTo: string = AUTH_REDIRECT_URL,
): Promise<string> {
  if (!supabase) {
    throw new Error('Supabase is not configured. Missing VITE_SUPABASE_* env vars.');
  }
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'discord',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });
  if (error) throw error;
  if (!data.url) throw new Error('Discord returned no authorization URL.');
  return data.url;
}

/**
 * Handle a deep-link callback URL coming back from the OAuth provider.
 * PKCE returns `?code=...`; older/implicit flows return `#access_token=...`.
 */
export async function handleAuthCallbackUrl(rawUrl: string): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const parsed = new URL(rawUrl);
  const code = parsed.searchParams.get('code');
  const params = new URLSearchParams(parsed.hash.slice(1));

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return;
  }

  const accessToken = params.get('access_token');
  if (accessToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: params.get('refresh_token') ?? '',
      expires_in: Number(params.get('expires_in') ?? 3600),
    });
    if (error) throw error;
    return;
  }

  const errMsg = parsed.searchParams.get('error');
  if (errMsg) throw new Error(`Authorization failed: ${errMsg}`);
  throw new Error('Unknown auth callback payload.');
}

/** Restore a persisted session (from the OS keyring) on app launch. */
export async function getSession(): Promise<Session | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/** Subscribe to auth state changes. Returns an unsubscribe function. */
export function onAuthStateChange(
  callback: (event: string, session: Session | null) => void,
): () => void {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((event, session) =>
    callback(event, session),
  );
  return () => data.subscription.unsubscribe();
}

/** Sign out, clearing the keyring session. */
export async function signOut(): Promise<void> {
  try {
    await supabase?.auth.signOut();
  } catch (err) {
    console.error('[auth] logout failed:', err);
  }
}

/**
 * Build a display profile from a Supabase session.
 * `provider_id` is the numeric Discord user ID.
 */
export function buildProfile(session: Session): DiscordProfile {
  const meta = session.user.user_metadata ?? {};
  const discordMeta = meta.discord ?? {};
  const identity = session.user.identities?.find((i) => i.provider === 'discord');
  const id = String(meta.provider_id ?? discordMeta.id ?? identity?.id ?? session.user.id ?? '');
  return {
    discordId: id,
    username:
      meta.user_name ?? discordMeta.username ?? session.user.user_metadata?.full_name ?? 'Discord User',
    displayName:
      meta.full_name ?? discordMeta.global_name ?? meta.user_name ?? 'Discord User',
    avatarUrl: meta.avatar_url ?? discordMeta.avatar_url ?? null,
    email: session.user.email ?? null,
  };
}

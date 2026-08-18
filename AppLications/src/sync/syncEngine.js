import { supabase } from '../services/authService';

/**
 * Local mirror of the cloud sync payload. Stored in localStorage so the app
 * still has the snapshot on this machine even when offline or signed out.
 * Keys: `micah_sync_state`.
 */
const LOCAL_STATE_KEY = 'micah_sync_state';

export function defaultSyncState() {
  return {
    discord_id: null,
    last_synced_at: null,
    injected_games: [],
    app_settings: {},
  };
}

export function loadLocalSyncState() {
  try {
    const raw = localStorage.getItem(LOCAL_STATE_KEY);
    if (!raw) return defaultSyncState();
    const parsed = JSON.parse(raw);
    return { ...defaultSyncState(), ...parsed };
  } catch {
    return defaultSyncState();
  }
}

export function saveLocalSyncState(state) {
  localStorage.setItem(LOCAL_STATE_KEY, JSON.stringify(state));
  return state;
}

/**
 * Map the app's on-disk game list (from `listGames`) into the cloud schema.
 * Managed Lua scripts are named `G-{appid}.lua`.
 */
export function gamesToSyncPayload(games) {
  return (games ?? []).map((g) => ({
    app_id: String(g.appid),
    game_name: g.name ?? `App ${g.appid}`,
    is_enabled: Boolean(g.enabled),
    script_name: `G-${g.appid}.lua`,
    custom_configs: { auto_load: true },
  }));
}

/** Keep any existing custom_configs / script_name when re-mapping. */
export function mergeGameSnapshots(prevInjected, nextGames) {
  const next = gamesToSyncPayload(nextGames);
  const prevById = new Map((prevInjected ?? []).map((g) => [String(g.app_id), g]));
  return next.map((g) => ({
    ...g,
    script_name: prevById.get(g.app_id)?.script_name ?? g.script_name,
    custom_configs: { auto_load: true, ...(prevById.get(g.app_id)?.custom_configs ?? {}) },
  }));
}

/** True for placeholder names like "App 4458730" (unresolved game names). */
export function isPlaceholderName(name) {
  return /^App \d+$/.test(String(name ?? ''));
}

/** Pick the real name when one side still has a placeholder. */
export function betterGameName(a, b) {
  if (isPlaceholderName(a)) return b ?? a;
  if (isPlaceholderName(b)) return a ?? b;
  return a ?? b;
}

/**
 * Union-merge a cloud snapshot with the local snapshot. Games/app settings
 * captured locally (e.g. while signed out as guest) overlay the cloud copy
 * so nothing is lost when signing in. Per-app_id the local entry wins, but
 * the real game name is kept when either side has resolved it.
 */
export function mergeCloudAndLocal(cloud, local) {
  const cloudGames = cloud?.injected_games ?? [];
  const localGames = local?.injected_games ?? [];
  const merged = new Map(cloudGames.map((g) => [String(g.app_id), g]));
  for (const g of localGames) {
    const id = String(g.app_id);
    const existing = merged.get(id);
    merged.set(id, {
      ...(existing ?? {}),
      ...g,
      game_name: betterGameName(g.game_name, existing?.game_name),
    });
  }
  return {
    discord_id: cloud?.discord_id ?? local?.discord_id ?? null,
    last_synced_at: cloud?.last_synced_at ?? local?.last_synced_at ?? null,
    injected_games: [...merged.values()],
    app_settings: {
      ...(cloud?.app_settings ?? {}),
      ...(local?.app_settings ?? {}),
    },
  };
}

/**
 * Upsert the user's full snapshot into `public.user_configs`.
 * RLS ensures the write only lands on the caller's own `user_id`.
 */
export async function pushSnapshot(session, { injectedGames, appSettings } = {}) {
  if (!supabase) throw new Error('Supabase is not configured.');
  if (!session?.user?.id) throw new Error('Not signed in.');

  const local = loadLocalSyncState();
  const payload = {
    user_id: session.user.id,
    discord_id: session.user.user_metadata?.provider_id ?? local.discord_id ?? null,
    injected_games: injectedGames ?? local.injected_games ?? [],
    app_settings: appSettings ?? local.app_settings ?? {},
  };

  const { error } = await supabase.from('user_configs').upsert(payload, {
    onConflict: 'user_id',
  });
  if (error) throw error;

  const synced = saveLocalSyncState({
    ...local,
    ...payload,
    last_synced_at: new Date().toISOString(),
  });
  return synced;
}

/** Fetch the user's snapshot from the cloud. Returns null when never synced. */
export async function pullSnapshot(session) {
  if (!supabase) throw new Error('Supabase is not configured.');
  if (!session?.user?.id) throw new Error('Not signed in.');

  const { data, error } = await supabase
    .from('user_configs')
    .select('discord_id, injected_games, app_settings, updated_at')
    .eq('user_id', session.user.id)
    .maybeSingle();
  if (error) throw error;

  if (!data) return null;

  return saveLocalSyncState({
    discord_id: data.discord_id ?? session.user.user_metadata?.provider_id ?? null,
    last_synced_at: data.updated_at ?? new Date().toISOString(),
    injected_games: data.injected_games ?? [],
    app_settings: data.app_settings ?? {},
  });
}

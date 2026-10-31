import React, { useMemo, useState } from 'react';

/**
 * Steam image helpers shared by search, the game card and the preview modal.
 *
 * The Rust backend normally supplies the exact store header (including the
 * hashed path for newer apps). These fallbacks cover older apps, regional CDN
 * failures and DLC/tools whose un-hashed static paths do not exist.
 */
export const STEAM_STORE_HOSTS = [
  'https://shared.akamai.steamstatic.com',
  'https://shared.cloudflare.steamstatic.com',
  'https://shared.fastly.steamstatic.com',
];

export const STEAM_LEGACY_HOSTS = [
  'https://cdn.cloudflare.steamstatic.com',
  'https://cdn.akamai.steamstatic.com',
  'https://cdn.fastly.steamstatic.com',
];

const STEAM_ASSETS = [
  'header.jpg',
  'capsule_616x353.jpg',
  'library_600x900.jpg',
  'capsule_231x87.jpg',
  'hero_capsule.jpg',
  'logo.png',
];

const isImageUrl = (value) =>
  typeof value === 'string' && /^(https?:\/\/|data:image\/)/i.test(value.trim());

/** Square community art is a badge, never a full-bleed cover. */
const isCommunityIcon = (value) =>
  typeof value === 'string' && /\/steamcommunity\/public\/images\/apps\//i.test(value);

/** Build an ordered, de-duplicated list of candidates for one appid. */
export function steamImageCandidates(appid, ...preferred) {
  const id = String(appid ?? '').trim();
  const out = [];
  const seen = new Set();
  const push = (url) => {
    if (!isImageUrl(url)) return;
    const clean = url.trim();
    if (seen.has(clean)) return;
    seen.add(clean);
    out.push(clean);
  };

  for (const value of preferred) push(value);

  // Keep the same hashed asset path when only the CDN host is blocked. This is
  // how newer apps' covers survive an akamai/cloudflare/fastly outage.
  const pushHashedVariants = (url) => {
    const match = /^https:\/\/shared\.(?:akamai|cloudflare|fastly)\.steamstatic\.com(\/store_item_assets\/steam\/apps\/\d+\/.+)$/i.exec(
      String(url ?? '').trim(),
    );
    if (!match) return;
    for (const host of STEAM_STORE_HOSTS) push(`${host}${match[1]}`);
  };
  for (const value of preferred) pushHashedVariants(value);

  if (/^\d+$/.test(id)) {
    for (const asset of STEAM_ASSETS) {
      for (const host of STEAM_STORE_HOSTS) {
        push(`${host}/store_item_assets/steam/apps/${id}/${asset}`);
      }
      for (const host of STEAM_LEGACY_HOSTS) {
        push(`${host}/steam/apps/${id}/${asset}`);
      }
    }
  }
  return out;
}

export default function SteamImage({
  appid,
  src,
  fallbackSrc,
  placeholderSrc,
  alt = '',
  style,
  className,
  loading = 'lazy',
  decoding = 'async',
  fallback = null,
  ...rest
}) {
  const candidates = useMemo(() => {
    const list = steamImageCandidates(appid, src, fallbackSrc);
    if (isImageUrl(placeholderSrc)) {
      const placeholder = placeholderSrc.trim();
      if (!list.includes(placeholder)) list.push(placeholder);
    }
    return list;
  }, [appid, src, fallbackSrc, placeholderSrc]);
  const key = candidates.join('|');
  // Reset to the first candidate synchronously when the source list changes —
  // an effect reset would render one frame with a stale (possibly failed)
  // index, which showed up as a brief fallback/blank flash on the game card.
  const [state, setState] = useState({ key, index: 0, loaded: false });
  if (state.key !== key) {
    setState({ key, index: 0, loaded: false });
  }
  const index = state.key === key ? state.index : 0;
  const loaded = state.key === key ? state.loaded : false;

  const handleLoad = () => {
    setState((s) => (s.key === key && s.index === index ? { ...s, loaded: true } : s));
  };
  const handleError = () => {
    setState({ key, index: index + 1, loaded: false });
  };

  if (index >= candidates.length) return fallback;
  if (isCommunityIcon(candidates[index])) {
    return (
      <div
        className={className}
        title={alt}
        style={{
          ...style,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          background:
            'radial-gradient(circle at 30% 20%, rgba(226, 77, 126, 0.28), transparent 60%), #17171d',
        }}
      >
        <img
          src={candidates[index]}
          alt={alt}
          loading={loading}
          decoding={decoding}
          referrerPolicy="no-referrer"
          style={{
            width: '54%',
            height: '54%',
            objectFit: 'contain',
            borderRadius: 8,
            background: 'rgba(255, 255, 255, 0.06)',
            padding: 3,
            opacity: loaded ? 1 : 0,
            transition: 'opacity 0.28s ease',
          }}
          onLoad={handleLoad}
          onError={handleError}
        />
      </div>
    );
  }
  return (
    <img
      src={candidates[index]}
      alt={alt}
      className={className}
      style={{ ...style, opacity: loaded ? 1 : 0, transition: 'opacity 0.28s ease' }}
      loading={loading}
      decoding={decoding}
      referrerPolicy="no-referrer"
      onLoad={handleLoad}
      onError={handleError}
      {...rest}
    />
  );
}

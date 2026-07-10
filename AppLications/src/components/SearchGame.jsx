import React, { useState, useRef, useCallback } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { invoke } from '@tauri-apps/api/core';

// Register GSAP hook
gsap.registerPlugin(useGSAP);

// ─── Debounce helper ─────────────────────────────────────────────────────────
function useDebounce(fn, delay) {
  const timer = useRef(null);
  return useCallback((...args) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => fn(...args), delay);
  }, [fn, delay]);
}

// ─── Multi-proxy fetcher for browser dev mode ───────────────────────────────
const CORS_PROXIES = [
  (url) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
  (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
];

async function fetchWithProxy(url) {
  for (const makeProxy of CORS_PROXIES) {
    try {
      const resp = await fetch(makeProxy(url), { signal: AbortSignal.timeout(6000) });
      if (!resp.ok) continue;
      const text = await resp.text();
      return JSON.parse(text);
    } catch {
      // try next proxy
    }
  }
  throw new Error('All proxies failed');
}

// ─── SearchGame Component ─────────────────────────────────────────────────────
const SearchGame = ({ onSelectGame, className = '', style = {} }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  const iconRef = useRef(null);

  // ── Fetch search results from Steam Store API (via Tauri proxy) ──────────
  const fetchSearchResults = useCallback(async (q) => {
    if (!q.trim() || q.trim().length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    try {
      // Primary: Tauri Rust backend (avoids CORS completely)
      const items = await invoke('search_steam_games', { query: q });
      setResults(items);
      if (items.length > 0) setIsOpen(true);
    } catch {
      // Fallback for browser dev mode: use CORS proxies
      try {
        const steamUrl = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(q)}&l=english&cc=US`;
        const json = await fetchWithProxy(steamUrl);
        const items = (json.items || []).slice(0, 8).map((item) => ({
          appid: item.id,
          name: item.name,
          header_image: `https://cdn.cloudflare.steamstatic.com/steam/apps/${item.id}/header.jpg`,
        }));
        setResults(items);
        if (items.length > 0) setIsOpen(true);
        else setResults([]);
      } catch {
        console.warn('Steam search: all proxies failed. Please run via Tauri (cargo tauri dev).');
        setResults([]);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const debouncedSearch = useDebounce(fetchSearchResults, 350);

  const handleQueryChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    debouncedSearch(val);
  };

  // ── When user clicks a search result, load full game details ────────────
  const handleItemClick = async (item) => {
    setIsOpen(false);
    setQuery('');
    setIsLoadingDetail(true);

    // Bounce feedback on input
    gsap.timeline()
      .to(inputRef.current, { scale: 0.97, duration: 0.08 })
      .to(inputRef.current, { scale: 1, duration: 0.2, ease: 'elastic.out(1.1)' });

    try {
      const detail = await invoke('get_steam_game_detail', { appid: item.appid });

      const gameObj = {
        title: detail.name,
        developer: detail.developers?.[0] || detail.publishers?.[0] || 'Unknown',
        imageSrc: detail.header_image,
        score: detail.metacritic > 0 ? detail.metacritic : (detail.score || 0),
        scoreLabel: detail.score_label || 'N/A',
        price: detail.price || 'N/A',
        tags: detail.genres?.slice(0, 4) || [],
        categories: detail.categories || [],
        publishers: detail.publishers || [],
        shortDescription: detail.short_description || '',
        releaseDate: detail.release_date || '',
        metacritic: detail.metacritic || 0,
        appid: detail.appid,
        pcRequirementsMinimum: detail.pc_requirements_minimum || '',
        pcRequirementsRecommended: detail.pc_requirements_recommended || '',
      };
      onSelectGame(gameObj);
    } catch {
      // Fallback for browser dev mode: use CORS proxies
      try {
        const steamUrl = `https://store.steampowered.com/api/appdetails?appids=${item.appid}&cc=US&l=english`;
        const json = await fetchWithProxy(steamUrl);
        const key = String(item.appid);
        if (json[key]?.success) {
          const d = json[key].data;
          const mc = d.metacritic?.score || 0;
          onSelectGame({
            title: d.name,
            developer: d.developers?.[0] || d.publishers?.[0] || 'Unknown',
            imageSrc: d.header_image,
            score: mc,
            scoreLabel: mc >= 90 ? 'Overwhelmingly Positive' : mc >= 75 ? 'Very Positive' : mc >= 60 ? 'Mostly Positive' : mc > 0 ? 'Mixed' : 'N/A',
            price: d.is_free ? 'Free' : (d.price_overview?.final_formatted || 'N/A'),
            tags: (d.genres || []).slice(0, 4).map(g => g.description),
            categories: (d.categories || []).map(c => c.description),
            publishers: d.publishers || [],
            shortDescription: d.short_description || '',
            releaseDate: d.release_date?.date || '',
            metacritic: mc,
            appid: item.appid,
            pcRequirementsMinimum: d.pc_requirements?.minimum || '',
            pcRequirementsRecommended: d.pc_requirements?.recommended || '',
          });
        } else {
          throw new Error('appdetails returned no data');
        }
      } catch {
        // Last resort: use minimal data from search result
        onSelectGame({
          title: item.name,
          developer: 'Unknown',
          imageSrc: item.header_image,
          score: 0,
          scoreLabel: 'N/A',
          price: 'N/A',
          tags: [],
        });
      }
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // ── GSAP dropdown open/close animation ──────────────────────────────────
  useGSAP(() => {
    if (isOpen && dropdownRef.current) {
      gsap.fromTo(dropdownRef.current,
        { opacity: 0, y: -8, scaleY: 0.95 },
        { opacity: 1, y: 0, scaleY: 1, duration: 0.22, ease: 'back.out(1.2)', transformOrigin: 'top center' }
      );
      const items = dropdownRef.current?.querySelectorAll('.search-item');
      if (items && items.length > 0) {
        gsap.fromTo(items,
          { opacity: 0, x: -12 },
          { opacity: 1, x: 0, duration: 0.18, stagger: 0.035, ease: 'power2.out' }
        );
      }
      gsap.to(iconRef.current, { rotation: 90, scale: 1.1, color: '#30302e', duration: 0.25, ease: 'power2.out' });
    } else {
      gsap.to(iconRef.current, { rotation: 0, scale: 1, color: '#87867f', duration: 0.18 });
    }
  }, { dependencies: [isOpen, results], scope: containerRef });

  const handleFocus = () => {
    if (results.length > 0) setIsOpen(true);
  };
  const handleBlur = () => {
    setTimeout(() => setIsOpen(false), 200);
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${className}`}
      style={{
        fontFamily: "'Outfit', 'Segoe UI', sans-serif",
        userSelect: 'none',
        ...style,
      }}
    >
      {/* Stable hover/press wrapper to avoid GSAP jitter */}
      <div
        onMouseEnter={() => {
          gsap.to(inputRef.current, { y: -3, boxShadow: '0 6px 0 var(--card-shadow)', duration: 0.18, ease: 'power2.out' });
        }}
        onMouseLeave={() => {
          gsap.to(inputRef.current, { y: 0, boxShadow: '0 4px 0 var(--card-shadow)', duration: 0.18, ease: 'power2.out' });
        }}
        onMouseDown={() => {
          gsap.to(inputRef.current, { y: 2, boxShadow: '0 2px 0 var(--card-shadow)', duration: 0.08 });
        }}
        onMouseUp={() => {
          gsap.to(inputRef.current, { y: -3, boxShadow: '0 6px 0 var(--card-shadow)', duration: 0.12, ease: 'back.out(1.2)' });
        }}
        style={{ paddingBottom: '6px', cursor: 'pointer' }}
      >
        {/* Visual input container */}
        <div
          ref={inputRef}
          style={{
            display: 'flex',
            alignItems: 'center',
            background: 'var(--card-bg)',
            border: '2px solid var(--card-border)',
            borderRadius: '16px',
            padding: '8px 16px',
            boxShadow: '0 4px 0 var(--card-shadow)',
            transition: 'background-color 0.15s, border-color 0.15s, box-shadow 0.15s',
          }}
        >
          {/* Search icon */}
          <span ref={iconRef} style={{ display: 'inline-flex', marginRight: '10px', color: 'var(--text-muted)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </span>

          {/* Input */}
          <input
            type="text"
            value={query}
            onChange={handleQueryChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder="Search Steam Games (e.g. Elden Ring, Portal 2...)"
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontFamily: 'inherit',
              fontSize: '14px',
              color: 'var(--text-color)',
              fontWeight: '500',
            }}
          />

          {/* Loading spinner or clear button */}
          {isLoading ? (
            <span style={{ display: 'inline-flex', color: 'var(--text-muted)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                style={{ animation: 'spin 0.8s linear infinite' }}>
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
            </span>
          ) : query ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setQuery('');
                setResults([]);
                setIsOpen(false);
              }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px', display: 'inline-flex' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          ) : null}
        </div>
      </div>

      {/* Dropdown results */}
      {isOpen && results.length > 0 && (
        <div
          ref={dropdownRef}
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: 0,
            right: 0,
            background: 'var(--card-bg)',
            border: '2px solid var(--card-border)',
            borderRadius: '16px',
            boxShadow: '0 6px 0 var(--card-shadow), 0 16px 32px rgba(0,0,0,var(--shadow-opacity))',
            zIndex: 200,
            maxHeight: '280px',
            overflowY: 'auto',
            transformOrigin: 'top center',
            padding: '8px',
            transition: 'background-color 0.15s, border-color 0.15s, box-shadow 0.15s',
          }}
          className="thin-scrollbar"
        >
          {results.map((item) => (
            <div
              key={item.appid}
              onClick={() => handleItemClick(item)}
              className="search-item"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '8px 12px',
                borderRadius: '10px',
                cursor: 'pointer',
                transition: 'background-color 0.15s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--button-hover-bg)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              {/* Thumbnail */}
              <img
                src={item.header_image}
                alt={item.name}
                style={{
                  width: '54px',
                  height: '30px',
                  objectFit: 'cover',
                  borderRadius: '5px',
                  border: '1px solid var(--card-border)',
                }}
              />
              {/* Game name */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-color)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.name}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                  App ID: {item.appid}
                </div>
              </div>
              {/* Arrow indicator */}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.5">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </div>
          ))}
        </div>
      )}

      {/* Global spinner style */}
      <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>

      {/* Loading detail overlay */}
      {isLoadingDetail && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--card-bg)',
          opacity: 0.85,
          borderRadius: '16px',
          fontSize: '12px',
          fontWeight: '700',
          color: 'var(--text-muted)',
          gap: '8px',
          backdropFilter: 'blur(3px)',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            style={{ animation: 'spin 0.8s linear infinite' }}>
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
          </svg>
          Loading game data from Steam...
        </div>
      )}
    </div>
  );
};

export default SearchGame;

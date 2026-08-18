import React, { useRef, useState } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { invoke } from '@tauri-apps/api/core';
import { Toast, useToast } from './Toast';

gsap.registerPlugin(useGSAP);

// Mock system requirements database for games
const SYSTEM_REQUIREMENTS = {
  'Elden Ring': {
    categories: ['Single-player', 'Online PvP', 'Steam Achievements', 'Steam Cloud'],
    minimum: {
      os: 'Windows 10 64-bit',
      cpu: 'Intel Core i5-8400 or AMD Ryzen 3 3300X',
      ram: '12 GB RAM',
      gpu: 'NVIDIA GeForce GTX 1060 3 GB or AMD Radeon RX 580 4 GB',
      dx: 'Version 12',
      storage: '60 GB available space (SSD recommended)'
    },
    recommended: {
      os: 'Windows 10 / 11 64-bit',
      cpu: 'Intel Core i7-8700K or AMD Ryzen 5 3600X',
      ram: '16 GB RAM',
      gpu: 'NVIDIA GeForce GTX 1070 8 GB or AMD Radeon RX Vega 56 8 GB',
      dx: 'Version 12',
      storage: '60 GB SSD space'
    }
  },
  'Portal 2': {
    categories: ['Single-player', 'Co-op', 'Shared/Split Screen', 'Steam Achievements', 'Steam Workshop'],
    minimum: {
      os: 'Windows 7 / Vista / XP / 10',
      cpu: '3.0 GHz P4, Dual Core 2.0 or AMD64X2',
      ram: '2 GB RAM',
      gpu: '128 MB VRAM (ATI Radeon X1900 / NVIDIA GeForce 7600)',
      dx: 'Version 9.0c',
      storage: '8 GB available space'
    },
    recommended: {
      os: 'Windows 10 64-bit',
      cpu: 'Intel Core 2 Duo 2.4GHz or equivalent',
      ram: '4 GB RAM',
      gpu: '512 MB VRAM Shader Model 3.0+ (ATI Radeon HD 2900 / NVIDIA GeForce 8800)',
      dx: 'Version 9.0c',
      storage: '8 GB SSD space'
    }
  },
  'Stardew Valley': {
    categories: ['Single-player', 'Online Co-op', 'LAN Co-op', 'Steam Achievements', 'Steam Cloud'],
    minimum: {
      os: 'Windows Vista or greater',
      cpu: '2.0 GHz Dual Core',
      ram: '2 GB RAM',
      gpu: '256 MB VRAM, Shader Model 3.0+ support',
      dx: 'Version 10',
      storage: '500 MB available space'
    },
    recommended: {
      os: 'Windows 10 / 11 64-bit',
      cpu: 'Intel i3 or AMD equivalent',
      ram: '4 GB RAM',
      gpu: '512 MB VRAM, Shader Model 4.0+',
      dx: 'Version 11',
      storage: '1 GB SSD space'
    }
  },
  'Hades': {
    categories: ['Single-player', 'Steam Achievements', 'Steam Cloud', 'Full Controller Support'],
    minimum: {
      os: 'Windows 7 SP1',
      cpu: 'Dual Core 2.4 GHz',
      ram: '4 GB RAM',
      gpu: '1 GB VRAM, Shader Model 3.0+ support',
      dx: 'Version 10',
      storage: '15 GB available space'
    },
    recommended: {
      os: 'Windows 10 64-bit',
      cpu: 'Dual Core 3.0 GHz+',
      ram: '8 GB RAM',
      gpu: '2 GB VRAM, Shader Model 4.0+',
      dx: 'Version 11',
      storage: '15 GB SSD space'
    }
  },
  'Cyberpunk 2077': {
    categories: ['Single-player', 'Steam Achievements', 'Steam Cloud', 'Ray Tracing Support'],
    minimum: {
      os: 'Windows 10 64-bit',
      cpu: 'Intel Core i7-6700 or AMD Ryzen 5 1600',
      ram: '12 GB RAM',
      gpu: 'NVIDIA GeForce GTX 1060 6GB or AMD Radeon RX 580 8GB',
      dx: 'Version 12',
      storage: '70 GB available space (SSD required)'
    },
    recommended: {
      os: 'Windows 10 / 11 64-bit',
      cpu: 'Intel Core i7-12700 or AMD Ryzen 7 7800X3D',
      ram: '16 GB RAM',
      gpu: 'NVIDIA GeForce RTX 2060 SUPER or AMD Radeon RX 5700 XT',
      dx: 'Version 12',
      storage: '70 GB SSD space'
    }
  },
  // Default specs for custom visual novel or missing entries
  'default': {
    categories: ['Single-player', 'Steam Cloud', 'Anime Elements'],
    minimum: {
      os: 'Windows 10 64-bit',
      cpu: 'Intel Core i3-3220 or AMD equivalent',
      ram: '4 GB RAM',
      gpu: 'Intel HD Graphics 4000 or NVIDIA GeForce GT 610',
      dx: 'Version 10',
      storage: '4 GB available space'
    },
    recommended: {
      os: 'Windows 10 / 11 64-bit',
      cpu: 'Intel Core i5 or AMD Ryzen 3',
      ram: '8 GB RAM',
      gpu: 'NVIDIA GeForce GTX 750 Ti or better',
      dx: 'Version 11',
      storage: '4 GB SSD space'
    }
  }
};

const scoreColor = (s) =>
  s >= 80 ? 'var(--led-color)' : s >= 60 ? '#c49a3a' : '#b85040';

const ImagePreviewModal = ({ game, onClose }) => {
  const overlayRef = useRef(null);
  const modalRef = useRef(null);
  const [manifestStatus, setManifestStatus] = useState('idle'); // idle, checking, found, not_found, error
  const [downloading, setDownloading] = useState(false);
  const { toast, show } = useToast();

  const handleAutoImport = async () => {
    if (!game.appid || downloading) return;
    setDownloading(true);
    try {
      const res = await invoke('auto_save_and_import_lua', { appid: game.appid, gameName: game.title });
      const target = res.steam_import_path || 'Steam config/lua';
      show(`OK: imported "${res.name}" -> ${target}`, 'success');
    } catch (err) {
      show(`Failed: ${err}`, 'error');
    } finally {
      setDownloading(false);
    }
  };

  if (!game) return null;

  const handleCheckManifest = async () => {
    if (!game.appid) return;
    setManifestStatus('checking');
    try {
      const found = await invoke('check_lua_manifest', { appid: game.appid });
      setManifestStatus(found ? 'found' : 'not_found');
    } catch {
      setManifestStatus('error');
    }
  };

  const sc = Math.max(0, Math.min(100, game.score || 0));
  const hasScore = sc > 0 && game.scoreLabel !== 'N/A';
  const sColor = hasScore ? scoreColor(sc) : '#b0aca4';

  // Parse dynamic requirements from Steam HTML if present
  const parseRequirements = (htmlStr) => {
    if (!htmlStr || typeof htmlStr !== 'string') return null;
    const extract = (pattern) => {
      const match = htmlStr.match(pattern);
      if (match && match[1]) {
        return match[1].replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
      }
      return null;
    };
    const os = extract(/<strong>OS:?<\/strong>\s*([^<]+)/i) || extract(/OS:?\s*([^<]+)/i);
    const cpu = extract(/<strong>Processor:?<\/strong>\s*([^<]+)/i) || extract(/Processor:?\s*([^<]+)/i) || extract(/<strong>CPU:?<\/strong>\s*([^<]+)/i);
    const ram = extract(/<strong>Memory:?<\/strong>\s*([^<]+)/i) || extract(/Memory:?\s*([^<]+)/i) || extract(/<strong>RAM:?<\/strong>\s*([^<]+)/i);
    const gpu = extract(/<strong>Graphics:?<\/strong>\s*([^<]+)/i) || extract(/Graphics:?\s*([^<]+)/i) || extract(/<strong>Video Card:?<\/strong>\s*([^<]+)/i);
    const dx = extract(/<strong>DirectX:?<\/strong>\s*([^<]+)/i) || extract(/DirectX:?\s*([^<]+)/i);
    const storage = extract(/<strong>Storage:?<\/strong>\s*([^<]+)/i) || extract(/Storage:?\s*([^<]+)/i) || extract(/<strong>Hard Drive:?<\/strong>\s*([^<]+)/i);

    if (!os && !cpu && !ram && !gpu && !storage) return null;
    return {
      os: os || 'N/A',
      cpu: cpu || 'N/A',
      ram: ram || 'N/A',
      gpu: gpu || 'N/A',
      dx: dx || 'N/A',
      storage: storage || 'N/A',
    };
  };

  const parsedMin = parseRequirements(game.pcRequirementsMinimum);
  const parsedRec = parseRequirements(game.pcRequirementsRecommended);
  const staticSpecs = SYSTEM_REQUIREMENTS[game.title] || SYSTEM_REQUIREMENTS['default'];

  // If parsed is successful, use it; otherwise fallback to static, or null (which will render raw HTML)
  const minSpecs = parsedMin || (game.pcRequirementsMinimum ? null : staticSpecs.minimum);
  const recSpecs = parsedRec || (game.pcRequirementsRecommended ? null : staticSpecs.recommended);
  const categories = (game.categories && game.categories.length > 0) ? game.categories : staticSpecs.categories;

  const handleClose = () => {
    const tl = gsap.timeline({ onComplete: onClose });
    tl.to(modalRef.current, { scale: 0.94, opacity: 0, y: 15, duration: 0.2, ease: 'power2.in' });
    tl.to(overlayRef.current, { opacity: 0, duration: 0.15 }, '-=0.1');
  };

  useGSAP(() => {
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.fromTo(overlayRef.current, { opacity: 0 }, { opacity: 1, duration: 0.25 });
    tl.fromTo(modalRef.current,
      { scale: 0.94, opacity: 0, y: 20 },
      { scale: 1, opacity: 1, y: 0, duration: 0.4, ease: 'back.out(1.1)' },
      '-=0.12'
    );
  }, { scope: overlayRef });

  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Helper to render aligned system specification rows
  const renderSpecRow = (label, value) => (
    <div style={{ display: 'grid', gridTemplateColumns: '75px 1fr', gap: '8px', marginBottom: '8px', lineHeight: '1.4' }}>
      <span style={{ fontSize: '10.5px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
        {label}
      </span>
      <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-color)' }}>
        {value}
      </span>
    </div>
  );

  const renderSpecsContainer = (title, specs, rawHtml, isRecommended) => {
    const titleColor = isRecommended ? 'var(--led-color)' : '#b85040';
    const bgColor = isRecommended ? 'var(--card-bg-alt)' : 'var(--bg-grid)';
    
    return (
      <div style={{
        background: bgColor,
        border: '1.5px solid var(--card-border)',
        borderRadius: '16px',
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        boxShadow: '0 2px 0 var(--card-shadow)',
        maxHeight: '260px',
        overflowY: 'auto',
      }} className="thin-scrollbar">
        <h4 style={{ 
          fontSize: '11.5px', 
          fontWeight: '900', 
          color: titleColor, 
          textTransform: 'uppercase', 
          margin: '0 0 6px 0', 
          borderBottom: '1px dashed var(--card-border)', 
          paddingBottom: '6px', 
          letterSpacing: '0.5px' 
        }}>
          {title}
        </h4>
        {specs ? (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {renderSpecRow('OS', specs.os)}
            {renderSpecRow('CPU', specs.cpu)}
            {renderSpecRow('RAM', specs.ram)}
            {renderSpecRow('GPU', specs.gpu)}
            {renderSpecRow('DirectX', specs.dx)}
            {renderSpecRow('Storage', specs.storage)}
          </div>
        ) : rawHtml ? (
          <div 
            className="raw-html-specs"
            style={{ 
              fontSize: '10.5px', 
              fontWeight: '600', 
              color: 'var(--text-color)',
              lineHeight: '1.5'
            }}
            dangerouslySetInnerHTML={{ __html: rawHtml }}
          />
        ) : (
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>N/A</span>
        )}
      </div>
    );
  };

  return (
    <div
      ref={overlayRef}
      onClick={handleClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(27, 27, 26, 0.72)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        cursor: 'zoom-out',
        padding: '20px',
      }}
    >
      <div
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--card-bg)',
          border: '2px solid var(--card-border)',
          borderRadius: '24px',
          boxShadow: '0 8px 0 var(--card-shadow), 0 24px 48px rgba(0,0,0,var(--shadow-opacity))',
          overflow: 'hidden',
          width: '900px',
          maxWidth: '92vw',
          height: '620px',
          maxHeight: '86vh',
          display: 'flex',
          flexDirection: 'column',
          cursor: 'default',
          transition: 'background-color 0.15s, border-color 0.15s, box-shadow 0.15s',
        }}
      >
        {/* Top Header Bar (Cleaner, Emojis Removed) */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '14px 24px',
          borderBottom: '2px solid var(--card-border)',
          background: 'var(--bg-grid)',
          transition: 'background-color 0.15s, border-color 0.15s',
        }}>
          <span style={{
            fontFamily: "'Outfit', sans-serif",
            fontWeight: '900',
            fontSize: '13px',
            color: 'var(--text-color)',
            textTransform: 'uppercase',
            letterSpacing: '1px',
          }}>
            Steam Database Explorer: {game.title}
          </span>
          <button
            onClick={handleClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-color)',
              cursor: 'pointer',
              fontWeight: '900',
              fontSize: '18px',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              transition: 'background-color 0.2s',
            }}
            className="hover:bg-[var(--button-hover-bg)]"
          >
            ✕
          </button>
        </div>

        {/* Hero Banner */}
        <div style={{
          position: 'relative',
          flexShrink: 0,
          height: '280px',
          overflow: 'hidden',
          borderBottom: '2px solid var(--card-border)',
        }}>
          {game.imageSrc ? (
            <img
              src={game.imageSrc}
              alt={game.title}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--card-bg-alt)' }}>
              <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '2px' }}>
                No Cover Available
              </span>
            </div>
          )}

          {/* Gradient overlay */}
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to top, rgba(10,10,10,0.85) 0%, rgba(10,10,10,0.35) 55%, rgba(10,10,10,0.15) 100%)',
            pointerEvents: 'none',
          }} />

          {/* Overlay info */}
          <div style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: '16px',
            padding: '20px 28px',
          }}>
            <div style={{ minWidth: 0 }}>
              <h1 style={{
                fontSize: '30px',
                fontWeight: '900',
                color: '#ffffff',
                margin: '0 0 4px 0',
                letterSpacing: '-0.3px',
                textShadow: '0 2px 12px rgba(0,0,0,0.6)',
              }}>
                {game.title}
              </h1>
              <p style={{
                fontSize: '11px',
                fontWeight: '700',
                color: 'rgba(255,255,255,0.85)',
                textTransform: 'uppercase',
                letterSpacing: '1.5px',
                margin: 0,
                textShadow: '0 1px 6px rgba(0,0,0,0.6)',
              }}>
                Publisher / Developer: {game.developer}
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexShrink: 0 }}>
              {/* Score ring */}
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                border: `3px solid ${sColor}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: '900',
                fontSize: '22px',
                color: hasScore ? '#ffffff' : 'rgba(255,255,255,0.6)',
                background: 'rgba(15,15,14,0.55)',
                boxShadow: '0 4px 16px rgba(0,0,0,0.45)',
              }}>
                {hasScore ? sc : '?'}
              </div>
              <span style={{
                fontSize: '10px',
                fontWeight: '900',
                color: sColor,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                textShadow: '0 1px 6px rgba(0,0,0,0.6)',
                maxWidth: '80px',
              }}>
                {hasScore ? game.scoreLabel : 'No Reviews'}
              </span>

              {/* Price tag */}
              <div style={{
                background: 'rgba(15,15,14,0.65)',
                color: 'var(--led-color)',
                border: '1.5px solid rgba(255,255,255,0.25)',
                borderRadius: '12px',
                padding: '10px 18px',
                textAlign: 'center',
                fontWeight: '900',
                fontSize: '16px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.45)',
                transition: 'color 0.15s',
              }}>
                {game.price}
              </div>
            </div>
          </div>
        </div>

        {/* Manifest action strip */}
        {game.appid && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            padding: '12px 28px',
            background: 'var(--bg-grid)',
            borderBottom: '1px solid var(--card-border)',
            flexShrink: 0,
            transition: 'background-color 0.15s, border-color 0.15s',
          }}>
            <span style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Manifest Database
            </span>

            {manifestStatus === 'idle' && (
              <button
                onClick={handleCheckManifest}
                className="hover:bg-[var(--button-hover-bg)]"
                style={{
                  background: 'var(--tag-bg)',
                  color: 'var(--text-color)',
                  border: '1.5px solid var(--card-border)',
                  borderRadius: '10px',
                  padding: '8px 16px',
                  fontSize: '11px',
                  fontWeight: '800',
                  cursor: 'pointer',
                  transition: 'background-color 0.15s',
                }}
              >
                Check Manifest & Lua
              </button>
            )}

            {manifestStatus === 'checking' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0' }}>
                <span className="sm-spinner" style={{ width: '12px', height: '12px', border: '2px solid var(--text-color)', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'sm-spin 0.8s linear infinite' }} />
                <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)' }}>Checking...</span>
              </div>
            )}

            {manifestStatus === 'found' && (
              <button
                onClick={handleAutoImport}
                disabled={downloading}
                style={{
                  background: 'var(--led-btn)',
                  color: 'var(--on-led)',
                  border: '1.5px solid var(--led-btn)',
                  borderRadius: '10px',
                  padding: '8px 16px',
                  fontSize: '11px',
                  fontWeight: '800',
                  cursor: downloading ? 'wait' : 'pointer',
                  opacity: downloading ? 0.7 : 1,
                  transition: 'background-color 0.15s',
                }}
              >
                {downloading ? 'Importing...' : 'Download & Auto-Import (.lua)'}
              </button>
            )}

            {manifestStatus === 'not_found' && (
              <button
                onClick={handleCheckManifest}
                style={{
                  background: '#b85040',
                  color: '#fff',
                  border: '1.5px solid #b85040',
                  borderRadius: '10px',
                  padding: '8px 16px',
                  fontSize: '11px',
                  fontWeight: '800',
                  cursor: 'pointer',
                }}
              >
                Not Found (Retry)
              </button>
            )}

            {manifestStatus === 'error' && (
              <button
                onClick={handleCheckManifest}
                style={{
                  background: '#c49a3a',
                  color: '#fff',
                  border: '1.5px solid #c49a3a',
                  borderRadius: '10px',
                  padding: '8px 16px',
                  fontSize: '11px',
                  fontWeight: '800',
                  cursor: 'pointer',
                }}
              >
                Check Error (Retry)
              </button>
            )}
          </div>
        )}

        {/* Scrollable body */}
        <div
          className="thin-scrollbar"
          style={{
            flex: 1,
            minHeight: 0,
            padding: '24px 28px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '28px',
            background: 'var(--card-bg)',
            transition: 'background-color 0.15s',
          }}
        >
          {/* Game Features & Categories */}
          <div>
            <h3 style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 10px 0' }}>
              Game Features & Categories
            </h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {categories.map((cat, i) => (
                <span key={i} style={{
                  background: 'var(--card-bg-alt)',
                  color: 'var(--text-color)',
                  border: '1.5px solid var(--card-border)',
                  fontSize: '10px',
                  fontWeight: '700',
                  padding: '4px 10px',
                  borderRadius: '8px',
                  transition: 'background-color 0.15s, color 0.15s, border-color 0.15s',
                }}>
                  {cat}
                </span>
              ))}
            </div>
          </div>

          {/* Popular Genre Tags */}
          <div>
            <h3 style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 10px 0' }}>
              Popular Genre Tags
            </h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {game.tags.map((tag, i) => (
                <span key={i} style={{
                  background: 'var(--card-bg)',
                  color: 'var(--text-color)',
                  border: '1.5px solid var(--card-border)',
                  fontSize: '10px',
                  fontWeight: '700',
                  padding: '4px 10px',
                  borderRadius: '99px',
                  boxShadow: '0 2px 0 var(--card-shadow)',
                  transition: 'background-color 0.15s, color 0.15s, border-color 0.15s, box-shadow 0.15s',
                }}>
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* PC System Requirements */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>
              PC System Requirements
            </h3>

            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '16px',
            }}>
              {renderSpecsContainer('Minimum Specs', minSpecs, game.pcRequirementsMinimum, false)}
              {renderSpecsContainer('Recommended Specs', recSpecs, game.pcRequirementsRecommended, true)}
            </div>
          </div>

        </div>

        {/* Footer toolbar */}
        <div style={{
          padding: '12px 24px',
          background: 'var(--bg-grid)',
          borderTop: '2px solid var(--card-border)',
          fontSize: '10px',
          fontWeight: '700',
          color: 'var(--text-muted)',
          display: 'flex',
          justifyContent: 'space-between',
          letterSpacing: '0.5px',
          transition: 'background-color 0.15s, border-color 0.15s, color 0.15s',
        }}>
          <span>PRESS [ESC] TO DISMISS VIEW</span>
          <span>SECURE PROTOCOL DATA INCOMING</span>
        </div>
        {/* CSS block for parsing Steam's raw HTML lists gracefully */}
        <style>{`
          .raw-html-specs ul.bb_ul {
            list-style-type: none !important;
            padding-left: 0 !important;
            margin: 0 !important;
          }
          .raw-html-specs ul.bb_ul li {
            margin-bottom: 8px !important;
            line-height: 1.4 !important;
            list-style: none !important;
            font-size: 11px !important;
            display: block !important;
          }
          .raw-html-specs ul.bb_ul li strong {
            font-weight: 800 !important;
            color: var(--text-muted) !important;
            text-transform: uppercase !important;
            font-size: 10px !important;
            display: inline-block !important;
            margin-right: 6px !important;
          }
          `}</style>
      </div>
      <Toast toast={toast} />
    </div>
  );
};

export default ImagePreviewModal;

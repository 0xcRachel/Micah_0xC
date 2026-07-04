import React, { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

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
  s >= 80 ? '#4d9e6a' : s >= 60 ? '#c49a3a' : '#b85040';

const ImagePreviewModal = ({ game, onClose }) => {
  const overlayRef = useRef(null);
  const modalRef = useRef(null);

  if (!game) return null;

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
      <span style={{ fontSize: '10.5px', fontWeight: '800', color: '#87867f', textTransform: 'uppercase' }}>
        {label}
      </span>
      <span style={{ fontSize: '11px', fontWeight: '600', color: '#30302e' }}>
        {value}
      </span>
    </div>
  );

  const renderSpecsContainer = (title, specs, rawHtml, isRecommended) => {
    const titleColor = isRecommended ? '#4d9e6a' : '#b85040';
    const bgColor = isRecommended ? '#ede9e3' : '#f4f2ed';
    
    return (
      <div style={{
        background: bgColor,
        border: '1.5px solid #30302e',
        borderRadius: '16px',
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        boxShadow: '0 2px 0 #30302e',
        maxHeight: '260px',
        overflowY: 'auto',
      }} className="thin-scrollbar">
        <h4 style={{ 
          fontSize: '11.5px', 
          fontWeight: '900', 
          color: titleColor, 
          textTransform: 'uppercase', 
          margin: '0 0 6px 0', 
          borderBottom: '1px dashed #30302e', 
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
              color: '#30302e',
              lineHeight: '1.5'
            }}
            dangerouslySetInnerHTML={{ __html: rawHtml }}
          />
        ) : (
          <span style={{ fontSize: '11px', color: '#87867f', fontWeight: '600' }}>N/A</span>
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
          background: '#faf9f6',
          border: '2px solid #30302e',
          borderRadius: '24px',
          boxShadow: '0 8px 0 #30302e, 0 24px 48px rgba(48,48,46,0.18)',
          overflow: 'hidden',
          width: '860px',
          maxWidth: '90vw',
          height: '560px',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          cursor: 'default',
        }}
      >
        {/* Top Header Bar (Cleaner, Emojis Removed) */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '14px 24px',
          borderBottom: '2px solid #30302e',
          background: '#f4f2ed',
        }}>
          <span style={{
            fontFamily: "'Outfit', sans-serif",
            fontWeight: '900',
            fontSize: '13px',
            color: '#30302e',
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
              color: '#30302e',
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
            className="hover:bg-[#ede9e3]"
          >
            ✕
          </button>
        </div>

        {/* Content Area - Split Panel */}
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          
          {/* Left panel - Static Visual Column */}
          <div style={{
            width: '270px',
            background: '#f0eee6',
            borderRight: '2px solid #30302e',
            display: 'flex',
            flexDirection: 'column',
            padding: '24px 20px',
            gap: '18px',
          }}>
            {/* Image Cover */}
            <div style={{
              borderRadius: '16px',
              overflow: 'hidden',
              border: '2px solid #30302e',
              height: '145px',
              background: '#e8e3db',
              boxShadow: '0 3px 0 #30302e',
            }}>
              {game.imageSrc ? (
                <img
                  src={game.imageSrc}
                  alt={game.title}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#b0a99e' }}>
                  No Cover
                </div>
              )}
            </div>

            {/* Score info */}
            <div style={{
              background: '#faf9f6',
              border: '2px solid #30302e',
              borderRadius: '16px',
              padding: '16px 12px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 0 #30302e',
            }}>
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
                color: hasScore ? '#30302e' : '#b0aca4',
                background: '#f4f2ed',
              }}>
                {hasScore ? sc : '?'}
              </div>
              <span style={{ fontSize: '10px', fontWeight: '900', color: sColor, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {hasScore ? game.scoreLabel : 'No Reviews'}
              </span>
            </div>

            {/* Price tag */}
            <div style={{
              background: '#30302e',
              color: '#faf9f6',
              borderRadius: '12px',
              padding: '12px 8px',
              textAlign: 'center',
              fontWeight: '900',
              fontSize: '16px',
              boxShadow: '0 3px 0 rgba(0,0,0,0.15)',
            }}>
              {game.price}
            </div>
          </div>

          {/* Right panel - Scrollable details */}
          <div
            className="thin-scrollbar"
            style={{
              flex: 1,
              padding: '24px 28px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
              background: '#faf9f6',
            }}
          >
            {/* Header info */}
            <div>
              <h1 style={{ fontSize: '28px', fontWeight: '900', color: '#30302e', margin: '0 0 4px 0', letterSpacing: '-0.3px' }}>
                {game.title}
              </h1>
              <p style={{ fontSize: '11px', fontWeight: '700', color: '#87867f', textTransform: 'uppercase', letterSpacing: '1px' }}>
                Publisher / Developer: {game.developer}
              </p>
            </div>

            {/* Game Features & Categories */}
            <div>
              <h3 style={{ fontSize: '11px', fontWeight: '800', color: '#87867f', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 10px 0' }}>
                Game Features & Categories
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {categories.map((cat, i) => (
                  <span key={i} style={{
                    background: '#ede9e3',
                    color: '#30302e',
                    border: '1.5px solid #30302e',
                    fontSize: '10px',
                    fontWeight: '700',
                    padding: '4px 10px',
                    borderRadius: '8px',
                  }}>
                    {cat}
                  </span>
                ))}
              </div>
            </div>

            {/* Popular Genre Tags */}
            <div>
              <h3 style={{ fontSize: '11px', fontWeight: '800', color: '#87867f', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 10px 0' }}>
                Popular Genre Tags
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {game.tags.map((tag, i) => (
                  <span key={i} style={{
                    background: '#faf9f6',
                    color: '#30302e',
                    border: '1.5px solid #30302e',
                    fontSize: '10px',
                    fontWeight: '700',
                    padding: '4px 10px',
                    borderRadius: '99px',
                    boxShadow: '0 2px 0 #30302e',
                  }}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* PC System Requirements */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h3 style={{ fontSize: '11px', fontWeight: '800', color: '#87867f', textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>
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

        </div>

        {/* Footer toolbar */}
        <div style={{
          padding: '12px 24px',
          background: '#f4f2ed',
          borderTop: '2px solid #30302e',
          fontSize: '10px',
          fontWeight: '700',
          color: '#87867f',
          display: 'flex',
          justifyContent: 'space-between',
          letterSpacing: '0.5px',
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
            color: #87867f !important;
            text-transform: uppercase !important;
            font-size: 10px !important;
            display: inline-block !important;
            margin-right: 6px !important;
          }
        `}</style>
      </div>
    </div>
  );
};

export default ImagePreviewModal;

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

  const gameSpecs = SYSTEM_REQUIREMENTS[game.title] || SYSTEM_REQUIREMENTS['default'];
  const sColor = scoreColor(game.score);

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
                color: '#30302e',
                background: '#f4f2ed',
              }}>
                {game.score}
              </div>
              <span style={{ fontSize: '10px', fontWeight: '900', color: sColor, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {game.scoreLabel}
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
                {gameSpecs.categories.map((cat, i) => (
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
                {/* Minimum specs */}
                <div style={{
                  background: '#f4f2ed',
                  border: '1.5px solid #30302e',
                  borderRadius: '16px',
                  padding: '16px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}>
                  <h4 style={{ fontSize: '11.5px', fontWeight: '900', color: '#b85040', textTransform: 'uppercase', margin: '0 0 6px 0', borderBottom: '1px dashed #30302e', paddingBottom: '6px', letterSpacing: '0.5px' }}>
                    Minimum Specs
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {renderSpecRow('OS', gameSpecs.minimum.os)}
                    {renderSpecRow('CPU', gameSpecs.minimum.cpu)}
                    {renderSpecRow('RAM', gameSpecs.minimum.ram)}
                    {renderSpecRow('GPU', gameSpecs.minimum.gpu)}
                    {renderSpecRow('DirectX', gameSpecs.minimum.dx)}
                    {renderSpecRow('Storage', gameSpecs.minimum.storage)}
                  </div>
                </div>

                {/* Recommended specs */}
                <div style={{
                  background: '#ede9e3',
                  border: '1.5px solid #30302e',
                  borderRadius: '16px',
                  padding: '16px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}>
                  <h4 style={{ fontSize: '11.5px', fontWeight: '900', color: '#4d9e6a', textTransform: 'uppercase', margin: '0 0 6px 0', borderBottom: '1px dashed #30302e', paddingBottom: '6px', letterSpacing: '0.5px' }}>
                    Recommended Specs
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {renderSpecRow('OS', gameSpecs.recommended.os)}
                    {renderSpecRow('CPU', gameSpecs.recommended.cpu)}
                    {renderSpecRow('RAM', gameSpecs.recommended.ram)}
                    {renderSpecRow('GPU', gameSpecs.recommended.gpu)}
                    {renderSpecRow('DirectX', gameSpecs.recommended.dx)}
                    {renderSpecRow('Storage', gameSpecs.recommended.storage)}
                  </div>
                </div>
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
      </div>
    </div>
  );
};

export default ImagePreviewModal;

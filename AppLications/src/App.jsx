import React, { useState, useRef, useEffect } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { closeWindow, checkVersionRequirement, checkUpdateChannel } from './api';
import IntroOverlay from './components/IntroOverlay';
import Background from './components/Background';
import Character from './components/Character';
import ForceUpdate from './components/ForceUpdate';
import SettingsPage from './pages/SettingsPage';
import LikePage from './pages/LikePage';
import ProfileCard from './components/ProfileCard';
import SearchGame from './components/SearchGame';
import SystemInfoCard from './components/SystemInfoCard';
import ImagePreviewModal from './components/ImagePreviewModal';
import SteamManager from './components/SteamManager';
import AuthBadge from './components/AuthBadge';
import VersionBadge from './components/VersionBadge';
import { SyncProvider, useSync } from './sync/SyncProvider';

import charLight from '../../assets/img/char.png';
import charDark from '../../assets/img/dark_mode_char.png';
import './App.css';

gsap.registerPlugin(useGSAP);

// Page names: null | 'settings' | 'like' | 'steam'
const App = () => {
  const containerRef = useRef(null);
  const contentRef = useRef(null);
  const themeWaveRef = useRef(null);
  const waveBodyRef = useRef(null);
  const waveBlobRefs = useRef([]);
  const waveCrestRef = useRef(null);
  const waveAfterRef = useRef(null);
  const waveRipplesRef = useRef([]);
  const transitionTlRef = useRef(null);

  const { updateAppSettings } = useSync();

  // Version check state
  const [versionInfo, setVersionInfo] = useState(null);
  const [versionChecked, setVersionChecked] = useState(false);
  const [optionalDismissed, setOptionalDismissed] = useState(false);

  // Check version requirement on startup.
  // Race against a 6s timeout so the app never hangs on a black screen
  // if GitHub is unreachable.
  useEffect(() => {
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('version check timeout')), 6000),
    );

    Promise.race([checkVersionRequirement(), timeout])
      .then((info) => {
        console.log('[VersionCheck] result:', info);
        setVersionInfo(info);
        setVersionChecked(true);
      })
      .catch((err) => {
        // If version check fails (offline, timeout, etc.), allow the app to run.
        console.error('[VersionCheck] failed:', err);
        setVersionChecked(true);
      });
  }, []);

  // Background update check — runs every 30 minutes after startup.
  // Only triggers if startup check showed no update (status === 'none').
  // If the user has already dismissed an optional update, don't re-check
  // during the same session.
  useEffect(() => {
    if (versionInfo?.status !== 'none') return;

    const CHECK_INTERVAL = 30 * 60 * 1000; // 30 minutes
    let dismissed = false;

    const interval = setInterval(() => {
      if (dismissed) return;
      checkUpdateChannel('stable', false)
        .then((info) => {
          if (info.available && !dismissed) {
            console.log('[BackgroundUpdate] new version found:', info.version);
            setVersionInfo({
              current_version: info.current_version,
              minimum_version: info.current_version,
              latest_version: info.version,
              download_url: '',
              release_notes: info.body || '',
              status: 'optional',
            });
          }
        })
        .catch(() => {}); // Silent fail — network issues are expected
    }, CHECK_INTERVAL);

    return () => {
      clearInterval(interval);
      dismissed = true;
    };
  }, [versionInfo?.status]);

  const [currentPage, setCurrentPage] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedGame, setSelectedGame] = useState({
    title: 'Made By 0xcRachel',
    developer: '0xcRachel',
    imageSrc: 'https://i.pinimg.com/736x/06/48/7e/06487edbf6b5d533d311b71303d16952.jpg',
    score: 100,
    scoreLabel: 'Overwhelmingly Positive',
    price: '$99.99',
    tags: ['Developer', 'Team Discord', 'Open Source'],
  });

  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('setting_darkMode') === 'true';
  });

  const [animationsEnabled, setAnimationsEnabled] = useState(() => {
    const saved = localStorage.getItem('setting_animations');
    return saved !== null ? saved === 'true' : true;
  });

  // The auth badge stays hidden while the intro overlay is playing,
  // so it never floats on top of the intro animation.
  const [introActive, setIntroActive] = useState(animationsEnabled);

  // Apply dark mode class to body on mount/update
  React.useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }, [isDarkMode]);

  // Perf: hide home content with visibility (compositor-cheap) instead of a
  // full-screen blur filter while the intro curtain covers the screen.
  // A blur forces a repaint of the entire page every frame in WebView2.
  useGSAP(() => {
    // Only hide while the intro curtain is actually going to play; otherwise
    // toggling the setting mid-session could leave content invisible forever.
    gsap.set(contentRef.current, { autoAlpha: (animationsEnabled && introActive) ? 0 : 1 });
  }, { scope: containerRef, dependencies: [animationsEnabled, introActive] });

  const handleCovered = () => {
    gsap.to(contentRef.current, { autoAlpha: 1, duration: 0.35, ease: 'power2.out' });
  };

  const navigateTo = (page) => {
    setCurrentPage(page);
  };

  const handleBack = () => {
    setCurrentPage(null);
  };

  const handleExit = async () => {
    try {
      await closeWindow();
    } catch {
      try {
        const win = await getCurrentWindow();
        await win.close();
      } catch {
        window.close();
      }
    }
  };

  const { contextSafe } = useGSAP({ scope: containerRef });

  const handleToggleDarkMode = contextSafe((nextVal) => {
    // Rapid clicks: stop any in-flight wave before starting a new one so
    // layers never stack tweens (which caused jank / instant colour flips).
    transitionTlRef.current?.kill();
    const wave = themeWaveRef.current;
    const body = waveBodyRef.current;
    const crest = waveCrestRef.current;
    const after = waveAfterRef.current;
    const blobs = waveBlobRefs.current.filter(Boolean);
    const ripples = waveRipplesRef.current.filter(Boolean);
    if (!wave || !body || !crest || !after || blobs.length === 0) return;

    gsap.killTweensOf([body, crest, after, ...blobs, ...ripples]);

    // 1. Origin — the theme toggle itself; screen centre as a fallback.
    let startX = window.innerWidth / 2;
    let startY = window.innerHeight / 2;
    const toggleButton = document.getElementById('dark-mode-toggle');
    if (toggleButton) {
      const rect = toggleButton.getBoundingClientRect();
      startX = rect.left + rect.width / 2;
      startY = rect.top + rect.height / 2;
    }

    // 2. Incoming theme palette (the wave rides on top of the old theme).
    const targetBgColor = nextVal ? '#161215' : '#f8f6f0';
    const accent = nextVal ? '#ff5fa8' : '#ec5fa2';
    const accent2 = '#1f9e95';
    const rippleColors = [accent2, accent, accent2];

    // 3. Distance to the farthest corner, plus margin for the lagging blobs.
    const base = 100; // layer diameter in px
    const dx = Math.max(startX, window.innerWidth - startX);
    const dy = Math.max(startY, window.innerHeight - startY);
    const radius = Math.sqrt(dx * dx + dy * dy);
    const coverScale = (radius * 1.2) / (base / 2);

    // 4. Reset every layer at the toggle origin.
    //    The body is a union of same-colour blobs with small offsets, so the
    //    merged front undulates like water instead of reading as a circle.
    gsap.set(body, {
      transformOrigin: `${startX}px ${startY}px`,
      scale: 1,
      opacity: 1,
    });
    const blobSpecs = [
      { ox: 0, oy: 0, sx: 1, sy: 1, delay: 0 },
      { ox: 150, oy: -90, sx: 0.945, sy: 0.975, delay: 0.05 },
      { ox: -130, oy: 110, sx: 0.975, sy: 0.94, delay: 0.09 },
    ];
    blobs.forEach((el, i) => {
      const spec = blobSpecs[i % blobSpecs.length];
      gsap.set(el, {
        left: startX + spec.ox,
        top: startY + spec.oy,
        xPercent: -50,
        yPercent: -50,
        scaleX: 0,
        scaleY: 0,
        background: targetBgColor,
      });
    });

    gsap.set(crest, {
      left: startX,
      top: startY,
      xPercent: -50,
      yPercent: -50,
      scale: 0,
      borderColor: accent,
      boxShadow: `0 0 22px 4px ${accent}66`,
      opacity: 0.9,
    });
    gsap.set(after, {
      left: startX,
      top: startY,
      xPercent: -50,
      yPercent: -50,
      scale: 0,
      borderColor: accent,
      boxShadow: `0 0 16px 2px ${accent}44`,
      opacity: 0,
    });
    ripples.forEach((el, i) => {
      gsap.set(el, {
        left: startX,
        top: startY,
        xPercent: -50,
        yPercent: -50,
        scale: 0,
        borderColor: rippleColors[i % rippleColors.length],
        boxShadow: `0 0 12px ${rippleColors[i % rippleColors.length]}55`,
        opacity: 0.42 - i * 0.1,
      });
    });
    gsap.set(wave, { display: 'block' });

    const tl = gsap.timeline({ defaults: { overwrite: 'auto' } });
    transitionTlRef.current = tl;

    // 5. Wave body — layered blobs expand at slightly different rates.
    blobs.forEach((el, i) => {
      const spec = blobSpecs[i % blobSpecs.length];
      tl.to(el, {
        scaleX: coverScale * spec.sx,
        scaleY: coverScale * spec.sy,
        duration: 0.74 + i * 0.035,
        ease: 'power3.inOut',
      }, spec.delay);
    });

    // 6. Luminous crest on the leading edge, dissolving as it travels.
    tl.to(crest, { scale: coverScale * 1.01, duration: 0.72, ease: 'power2.inOut' }, 0);
    tl.to(crest, { opacity: 0, duration: 0.34, ease: 'power1.in' }, 0.26);

    // 7. Concentric ripples fan out ahead of the wave, slightly elliptical.
    ripples.forEach((el, i) => {
      const delay = 0.02 + i * 0.1;
      tl.to(el, {
        scaleX: coverScale * (1.25 + i * 0.15),
        scaleY: coverScale * (1.34 + i * 0.13),
        duration: 0.8 + i * 0.08,
        ease: 'power2.out',
      }, delay);
      tl.to(el, { opacity: 0, duration: 0.62 + i * 0.07, ease: 'power1.in' }, delay + 0.05);
    });

    // 8. Swap theme behind the fully covered screen. updateAppSettings
    //    (SyncProvider write → whole-tree re-render) stays in cleanup so
    //    React reconciliation never runs while the wave is moving fast.
    tl.call(() => {
      setIsDarkMode(nextVal);
      localStorage.setItem('setting_darkMode', String(nextVal));
    }, null, 0.6);

    // 9. The water body spreads once more, then disperses.
    tl.to(body, {
      scale: 1.04,
      opacity: 0,
      duration: 0.52,
      ease: 'power2.out',
    }, 0.78);

    // 10. A last ripple washes across the new theme and fades away.
    tl.to(after, {
      scaleX: coverScale * 1.34,
      scaleY: coverScale * 1.4,
      duration: 0.74,
      ease: 'power2.out',
    }, 0.58);
    tl.to(after, { opacity: 0.3, duration: 0.1 }, 0.58);
    tl.to(after, { opacity: 0, duration: 0.62, ease: 'power1.in' }, 0.7);

    // 11. Clean up off the critical path, then sync the theme to the cloud.
    tl.call(() => {
      gsap.set(wave, { display: 'none' });
      updateAppSettings({ theme: nextVal ? 'dark' : 'light' });
    }, null, 1.34);
  });

  const handleToggleAnimations = (nextVal) => {
    setAnimationsEnabled(nextVal);
    localStorage.setItem('setting_animations', String(nextVal));
  };

  // Determine if the app should be locked (force update) or allowed to run
  const isForceUpdate = versionInfo?.status === 'force';
  const isOptionalUpdate = versionInfo?.status === 'optional' && !optionalDismissed;

  // While version is being checked, show a loading screen (never a black screen)
  if (!versionChecked) {
    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        background: 'var(--bg-color, #f8f6f0)',
      }}>
        <span style={{
          width: 36,
          height: 36,
          border: '3px solid var(--remi-track, #f3c6da)',
          borderTopColor: 'var(--remi-arc, #1f9e95)',
          borderRadius: '50%',
          animation: 'fu-spin 0.7s linear infinite',
        }} />
        <p style={{ fontSize: 13, color: 'var(--text-muted, #87867f)', margin: 0 }}>
          Checking for updates…
        </p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <VersionBadge />
          <AuthBadge />
        </div>
      </div>
    );
  }

  // Force update — block the entire app
  if (isForceUpdate) {
    return <ForceUpdate versionInfo={versionInfo} isOptional={false} />;
  }

  const characterImage = isDarkMode ? charDark : charLight;

  return (
    <div ref={containerRef} className="min-h-screen relative overflow-hidden select-none">
      {animationsEnabled && (
        <IntroOverlay
          onCovered={handleCovered}
          onComplete={() => setIntroActive(false)}
        />
      )}
      <Background />

      {!introActive && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
          <VersionBadge />
          <AuthBadge />
        </div>
      )}

      {/* Theme wave overlay — layered blobs + ripples that swell and dissipate */}
      <div ref={themeWaveRef} className="theme-wave" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <div
            key={`ripple-${i}`}
            ref={(el) => { waveRipplesRef.current[i] = el; }}
            className="theme-wave-ring"
          />
        ))}
        <div ref={waveBodyRef} className="theme-wave-body">
          {[0, 1, 2].map((i) => (
            <div
              key={`blob-${i}`}
              ref={(el) => { waveBlobRefs.current[i] = el; }}
              className="theme-wave-blob"
            />
          ))}
        </div>
        <div ref={waveCrestRef} className="theme-wave-ring theme-wave-crest" />
        <div ref={waveAfterRef} className="theme-wave-ring theme-wave-after" />
      </div>

      {/* Home content */}
      <div
        ref={contentRef}
        className="relative z-10 w-full min-h-screen p-8 md:p-12 lg:p-16 flex flex-col justify-start gap-8"
      >
        {/* Search bar, Game Card & System Info diagnostics container */}
        <div style={{ width: '600px', maxWidth: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <SearchGame onSelectGame={setSelectedGame} />

          <ProfileCard
            title={selectedGame.title}
            developer={selectedGame.developer}
            imageSrc={selectedGame.imageSrc}
            score={selectedGame.score}
            scoreLabel={selectedGame.scoreLabel}
            price={selectedGame.price}
            tags={selectedGame.tags}
            appid={selectedGame.appid}
            onClick={() => setShowPreview(true)}
          />

          <SystemInfoCard />
        </div>
      </div>

      {/* Character — always rendered, lives on top of home */}
      <div className="absolute bottom-0 right-0 w-[50vw] h-[85vh] pointer-events-none z-20">
        <Character
          characterImage={characterImage}
          onSettings={() => navigateTo('settings')}
          onLike={() => navigateTo('like')}
          onExit={handleExit}
          onSteam={() => navigateTo('steam')}
        />
      </div>

      {/* Full-screen pages — mount only when active, unmount after exit animation */}
      {currentPage === 'settings' && (
        <SettingsPage
          onBack={handleBack}
          isDarkMode={isDarkMode}
          onToggleDarkMode={handleToggleDarkMode}
          animationsEnabled={animationsEnabled}
          onToggleAnimations={handleToggleAnimations}
        />
      )}
      {currentPage === 'like' && (
        <LikePage onBack={handleBack} />
      )}
      {currentPage === 'steam' && (
        <SteamManager onBack={handleBack} />
      )}

      {/* Image Preview Modal (Lightbox) */}
      {showPreview && selectedGame && (
        <ImagePreviewModal
          game={selectedGame}
          onClose={() => setShowPreview(false)}
        />
      )}

      {/* Optional update banner — non-blocking overlay */}
      {isOptionalUpdate && (
        <ForceUpdate
          versionInfo={versionInfo}
          isOptional={true}
          onSkip={() => setOptionalDismissed(true)}
        />
      )}
    </div>
  );
};

export default () => (
  <SyncProvider>
    <App />
  </SyncProvider>
);

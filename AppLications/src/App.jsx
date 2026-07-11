import React, { useState, useRef, useEffect } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { closeWindow, checkVersionRequirement } from './api';
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

import charLight from '../../assets/img/char.png';
import charDark from '../../assets/img/dark_mode_char.png';
import './App.css';

gsap.registerPlugin(useGSAP);

// Page names: null | 'settings' | 'like' | 'steam'
const App = () => {
  const containerRef = useRef(null);
  const contentRef = useRef(null);
  const transitionCircleRef = useRef(null);

  // Version check state
  const [versionInfo, setVersionInfo] = useState(null);
  const [versionChecked, setVersionChecked] = useState(false);

  // Check version requirement on startup
  useEffect(() => {
    checkVersionRequirement()
      .then((info) => {
        setVersionInfo(info);
        setVersionChecked(true);
      })
      .catch(() => {
        // If version check fails (offline, etc.), allow the app to run
        setVersionChecked(true);
      });
  }, []);

  const [currentPage, setCurrentPage] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedGame, setSelectedGame] = useState({
    title: 'Made By 0xcRachel',
    developer: '0xcRachel',
    imageSrc: 'https://i.pinimg.com/736x/c4/ea/c5/c4eac5f03beb69fac689e5c844b3db30.jpg',
    score: 100,
    scoreLabel: 'Overwhelmingly Positive',
    price: '$99.99',
    tags: ['Visual Novel', 'Anime', 'Story Rich']
  });

  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('setting_darkMode') === 'true';
  });

  const [animationsEnabled, setAnimationsEnabled] = useState(() => {
    const saved = localStorage.getItem('setting_animations');
    return saved !== null ? saved === 'true' : true;
  });

  // Apply dark mode class to body on mount/update
  React.useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }, [isDarkMode]);

  useGSAP(() => {
    if (animationsEnabled) {
      gsap.set(contentRef.current, { filter: 'blur(16px)' });
    } else {
      gsap.set(contentRef.current, { filter: 'blur(0px)' });
    }
  }, { scope: containerRef, dependencies: [animationsEnabled] });

  const handleCovered = () => {
    gsap.set(contentRef.current, { filter: 'blur(0px)' });
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
    // 1. Calculate transition starting coordinates
    let startX = window.innerWidth / 2;
    let startY = window.innerHeight / 2;

    // Try to get dark-mode-toggle button position in DOM
    const toggleButton = document.getElementById('dark-mode-toggle');
    if (toggleButton) {
      const rect = toggleButton.getBoundingClientRect();
      startX = rect.left + rect.width / 2;
      startY = rect.top + rect.height / 2;
    }

    // Determine target color based on transition
    const targetBgColor = nextVal ? '#161615' : '#f8f6f0';

    // 2. Position the transition circle and make it visible
    gsap.set(transitionCircleRef.current, {
      left: startX,
      top: startY,
      xPercent: -50,
      yPercent: -50,
      background: targetBgColor,
      display: 'block',
      scale: 0,
      opacity: 1,
    });

    // 3. Calculate max scale required to cover screen corners from start position
    const dx = Math.max(startX, window.innerWidth - startX);
    const dy = Math.max(startY, window.innerHeight - startY);
    const radius = Math.sqrt(dx * dx + dy * dy);
    const targetScale = (radius / 10) * 1.05; // circle radius is 10px (width 20px)

    // 4. Run transition timeline
    const tl = gsap.timeline();

    // Growth phase: scale up the circle to completely engulf the screen
    tl.to(transitionCircleRef.current, {
      scale: targetScale,
      duration: 0.6,
      ease: 'power2.in',
    });

    // Swapping phase: swap theme classes & state behind the solid screen cover
    tl.add(() => {
      setIsDarkMode(nextVal);
      localStorage.setItem('setting_darkMode', String(nextVal));
    });

    // Reveal phase: smoothly fade the overlay out
    tl.to(transitionCircleRef.current, {
      opacity: 0,
      duration: 0.45,
      ease: 'power2.out',
    });

    // Clean up phase: hide transition element
    tl.add(() => {
      gsap.set(transitionCircleRef.current, { display: 'none' });
    });
  });

  const handleToggleAnimations = (nextVal) => {
    setAnimationsEnabled(nextVal);
    localStorage.setItem('setting_animations', String(nextVal));
  };

  // Determine if the app should be locked (force update) or allowed to run
  const isForceUpdate = versionInfo?.status === 'force';
  const isOptionalUpdate = versionInfo?.status === 'optional';

  // While version is being checked, show nothing (loading state)
  if (!versionChecked) return null;

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
          onComplete={() => { }}
        />
      )}
      <Background />

      {/* Circle Transition Overlay */}
      <div
        ref={transitionCircleRef}
        style={{
          position: 'fixed',
          zIndex: 9999,
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          pointerEvents: 'none',
          transform: 'scale(0)',
          transformOrigin: 'center center',
          display: 'none',
        }}
      />

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
        <ForceUpdate versionInfo={versionInfo} isOptional={true} />
      )}
    </div>
  );
};

export default App;
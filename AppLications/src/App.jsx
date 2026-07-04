import React, { useState, useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import IntroOverlay from './components/IntroOverlay';
import Background from './components/Background';
import Character from './components/Character';
import SettingsPage from './pages/SettingsPage';
import LikePage from './pages/LikePage';
import './App.css';

gsap.registerPlugin(useGSAP);

// Page names: null | 'settings' | 'like'
const App = () => {
  const containerRef = useRef(null);
  const contentRef = useRef(null);
  const [currentPage, setCurrentPage] = useState(null);

  useGSAP(() => {
    gsap.set(contentRef.current, { filter: 'blur(16px)' });
  }, { scope: containerRef });

  const handleCovered = () => {
    gsap.set(contentRef.current, { filter: 'blur(0px)' });
  };

  const navigateTo = (page) => {
    setCurrentPage(page);
  };

  const handleBack = () => {
    // Called AFTER the page's own exit animation completes
    setCurrentPage(null);
  };

  const handleExit = async () => {
    try {
      const win = await getCurrentWindow();
      await win.close();
    } catch {
      window.close();
    }
  };

  return (
    <div ref={containerRef} className="min-h-screen relative overflow-hidden select-none">
      <IntroOverlay
        onCovered={handleCovered}
        onComplete={() => {}}
      />
      <Background />

      {/* Home content */}
      <div
        ref={contentRef}
        className="relative z-10 w-full min-h-screen p-8 md:p-12 lg:p-16 flex flex-col justify-between"
      />

      {/* Character — always rendered, lives on top of home */}
      <div className="absolute bottom-0 right-0 w-[50vw] h-[85vh] pointer-events-none z-20">
        <Character
          onSettings={() => navigateTo('settings')}
          onLike={() => navigateTo('like')}
          onExit={handleExit}
        />
      </div>

      {/* Full-screen pages — mount only when active, unmount after exit animation */}
      {currentPage === 'settings' && (
        <SettingsPage onBack={handleBack} />
      )}
      {currentPage === 'like' && (
        <LikePage onBack={handleBack} />
      )}
    </div>
  );
};

export default App;

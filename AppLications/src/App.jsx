import React, { useState, useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import IntroOverlay from './components/IntroOverlay';
import Background from './components/Background';
import Character from './components/Character';
import SettingsPage from './pages/SettingsPage';
import LikePage from './pages/LikePage';
import ProfileCard from './components/ProfileCard';
import SearchGame from './components/SearchGame';
import SystemInfoCard from './components/SystemInfoCard';
import ImagePreviewModal from './components/ImagePreviewModal';
import './App.css';

gsap.registerPlugin(useGSAP);

// Page names: null | 'settings' | 'like'
const App = () => {
  const containerRef = useRef(null);
  const contentRef = useRef(null);
  const [currentPage, setCurrentPage] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedGame, setSelectedGame] = useState({
    title: 'Kaoruko Waguri: Days',
    developer: 'VisualArts / Key',
    imageSrc: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=500&auto=format&fit=crop&q=80',
    score: 96,
    scoreLabel: 'Overwhelmingly Positive',
    price: '$19.99',
    tags: ['Visual Novel', 'Anime', 'Story Rich']
  });

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
        onComplete={() => { }}
      />
      <Background />

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
            onClick={() => setShowPreview(true)}
          />

          <SystemInfoCard />
        </div>
      </div>

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

      {/* Image Preview Modal (Lightbox) */}
      {showPreview && selectedGame && (
        <ImagePreviewModal
          game={selectedGame}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  );
};

export default App;

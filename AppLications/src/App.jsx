import React, { useState, useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import IntroOverlay from './components/IntroOverlay';
import './App.css';

gsap.registerPlugin(useGSAP);

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION: Easily swap character and console image paths here later.
// If left empty, a beautiful styled placeholder will be rendered.
// ─────────────────────────────────────────────────────────────────────────────
const CHARACTER_IMAGE_PATH = ""; // e.g., "/character.png"
const CONSOLE_IMAGE_PATH    = ""; // e.g., "/waguri.png"

// ─────────────────────────────────────────────────────────────────────────────
// HIGH-FIDELITY CUSTOM SVG ICONS (Replicating the designer mockup style)
// ─────────────────────────────────────────────────────────────────────────────

const MailIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current">
    <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-1 4l-7 4.5L5 8V6l7 4.5L19 6v2z" />
  </svg>
);

const RibbonIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current">
    <path d="M12 9c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3zm-4.5 1.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5S9 12.83 9 12s-.67-1.5-1.5-1.5zm9 0c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 11v1c0 1.66 1.34 3 3 3h1v2.93zm4.79-3.41l-2.08-1.2C15.89 12.86 16 12.44 16 12v-1c0-1.66-1.34-3-3-3h-1V5.07c3.95.49 7 3.85 7 7.93 0 1.83-.62 3.51-1.21 4.52z" />
  </svg>
);

const SunIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current">
    <path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zm0-5c.55 0 1 .45 1 1v2c0 .55-.45 1-1 1s-1-.45-1-1V3c0-.55.45-1 1-1zm0 14c.55 0 1 .45 1 1v2c0 .55-.45 1-1 1s-1-.45-1-1v-2c0-.55.45-1 1-1zm10-5c0 .55-.45 1-1 1h-2c0-.55-.45-1-1-1s.45-1 1-1h2c.55 0 1 .45 1 1zM7 12c0 .55-.45 1-1 1H4c-.55 0-1-.45-1-1s.45-1 1-1h2c.55 0 1 .45 1 1zm12.66-7.05c.39.39.39 1.02 0 1.41l-1.41 1.41c-.39.39-1.02.39-1.41 0s-.39-1.02 0-1.41l1.41-1.41c.4-.39 1.03-.39 1.41 0zM7.05 18.36c.39.39.39 1.02 0 1.41l-1.41 1.41c-.39.39-1.02.39-1.41 0s-.39-1.02 0-1.41l1.41-1.41c.4-.39 1.03-.39 1.41 0zm11.31 0c-.39-.39-.39-1.02 0-1.41l1.41-1.41c.39-.39 1.02-.39 1.41 0s.39 1.02 0 1.41l-1.41 1.41c-.39.38-1.03.38-1.41 0zM5.64 5.64c-.39-.39-.39-1.02 0-1.41l1.41-1.41c.39-.39 1.02-.39 1.41 0s.39 1.02 0 1.41L7.05 5.64c-.39.38-1.02.38-1.41 0z" />
  </svg>
);

const MusicIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current">
    <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6zm-2 16c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z" />
  </svg>
);

const FlowerIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current">
    <path d="M12 9c-1.65 0-3 1.35-3 3s1.35 3 3 3 3-1.35 3-3-1.35-3-3-3zm0-5c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm0 12c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm8-6c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm-12 0c0 1.1-.9 2-2 2S4 13.1 4 12s.9-2 2-2 2 .9 2 2z" />
  </svg>
);

const CatIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current">
    <path d="M12 3c-1.2 0-2.4.3-3.5.9L5.2 1.3C4.8.9 4.1 1.1 4 1.7L3.1 6.5C1.8 8.1 1 10.2 1 12.5c0 6.1 4.9 11 11 11s11-4.9 11-11c0-2.3-.8-4.4-2.1-6L20 1.7c-.1-.6-.8-.8-1.2-.4l-3.3 2.6C14.4 3.3 13.2 3 12 3zm4 11c.83 0 1.5.67 1.5 1.5S16.83 17 16 17s-1.5-.67-1.5-1.5.67-1.5 1.5-1.5zm-8 0c.83 0 1.5.67 1.5 1.5S9.83 17 9 17s-1.5-.67-1.5-1.5.67-1.5 1.5-1.5zm4 3.5c1.24 0 2.22-.72 2.74-1.5H9.26c.52.78 1.5 1.5 2.74 1.5z" />
  </svg>
);

const WorkflowArrow = () => (
  <svg viewBox="0 0 24 24" className="w-12 h-8 text-[#30302e] fill-current">
    <path d="M16.01 11H4v2h12.01v3L20 12l-3.99-4v3z" />
  </svg>
);

const App = () => {
  const containerRef = useRef(null);
  const contentRef = useRef(null);
  const [isIntroFinished, setIsIntroFinished] = useState(false);
  const [activeIcon, setActiveIcon] = useState(0);

  // Apply initial blur immediately on mount
  useGSAP(() => {
    gsap.set(contentRef.current, { filter: 'blur(16px)' });
  }, { scope: containerRef });

  const handleCovered = () => {
    gsap.set(contentRef.current, { filter: 'blur(0px)' });
  };

  // Entrance animations for UI components
  useGSAP(() => {
    if (!isIntroFinished) return;
    
    gsap.fromTo(
      contentRef.current.querySelectorAll('.animate-fade-in'),
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', stagger: 0.1 }
    );
  }, { dependencies: [isIntroFinished], scope: containerRef });

  return (
    <div ref={containerRef} className="min-h-screen notebook-grid relative overflow-hidden select-none">
      
      {/* Intro sequence */}
      <IntroOverlay
        onCovered={handleCovered}
        onComplete={() => setIsIntroFinished(true)}
      />

      {/* Main Grid Wrapper */}
      <div 
        ref={contentRef} 
        className="relative z-10 w-full min-h-screen p-8 md:p-12 lg:p-16 flex flex-col justify-between"
      >
        {/* Top Section: Title & Pills */}
        <div className="w-full flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 animate-fade-in">
          {/* Header Branding */}
          <div className="flex flex-col">
            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-[#30302e]">
              Material
            </h1>
            <span className="text-sm font-mono text-[#87867f] tracking-wide mt-1">
              by evelyn.dsnr
            </span>
          </div>

          {/* Action Pills (UPDATE / PROFILE) */}
          <div className="flex items-center gap-2">
            <button className="px-5 py-2 rounded-full bg-[#5e5d59] border-2 border-[#1b1b1a] text-xs font-bold text-[#f0eee6] hover:bg-[#4d4c48] active:translate-y-0.5 transition-all cursor-pointer tracking-wider uppercase">
              UPDATE
            </button>
            <button className="px-5 py-2 rounded-full bg-[#c4b99a] border-2 border-[#30302e]/20 text-xs font-bold text-[#30302e] hover:bg-[#d8ceb8] active:translate-y-0.5 transition-all cursor-pointer tracking-wider uppercase">
              PROFILE
            </button>
          </div>
        </div>

        {/* Middle Section: Workflow (Icons -> Arrow -> Counter) */}
        <div className="w-full max-w-4xl my-auto py-12 flex flex-col md:flex-row items-start md:items-center gap-8 md:gap-12 lg:gap-16 animate-fade-in">
          
          {/* Icon Dock */}
          <div className="flex items-center gap-2 bg-[#30302e] border-2 border-[#1b1b1a] rounded-2xl p-3 shadow-[4px_4px_0px_#1b1b1a]">
            {[
              { component: MailIcon, name: 'Mail' },
              { component: RibbonIcon, name: 'Ribbon' },
              { component: SunIcon, name: 'Sun' },
              { component: MusicIcon, name: 'Music' },
              { component: FlowerIcon, name: 'Flower' },
              { component: CatIcon, name: 'Cat' }
            ].map((icon, idx) => (
              <button
                key={idx}
                onClick={() => setActiveIcon(idx)}
                className={`w-12 h-12 flex items-center justify-center rounded-xl transition-all duration-150 cursor-pointer ${
                  activeIcon === idx 
                    ? 'bg-[#c4b99a] text-[#30302e] border-2 border-[#1b1b1a] translate-y-0.5 shadow-none'
                    : 'bg-[#4d4c48] text-[#f0eee6] hover:bg-[#5e5d59] active:translate-y-0.5'
                }`}
                title={icon.name}
              >
                <icon.component />
              </button>
            ))}
          </div>

          {/* Workflow Arrow */}
          <div className="hidden md:flex items-center justify-center">
            <WorkflowArrow />
          </div>

          {/* 20 Material Counter Display */}
          <div className="flex flex-col items-start min-w-[200px]">
            <div className="flex flex-col">
              <h2 className="text-8xl font-serif font-black text-[#30302e] leading-none tracking-tighter">
                20
              </h2>
              <div className="w-28 h-1.5 bg-[#30302e] mt-2 mb-2 rounded-full" />
              <span className="text-xl font-mono font-bold text-[#87867f] tracking-[0.25em] uppercase">
                material
              </span>
            </div>
          </div>

        </div>

        {/* Bottom Section: Console Screen Casing */}
        <div className="w-full max-w-xl animate-fade-in relative z-20">
          
          {/* Retro Console Wrapper */}
          <div className="relative w-full aspect-[16/9.5] rounded-[32px] border-4 border-[#1b1b1a] bg-[#30302e] p-6 console-box-shadow flex items-stretch">
            
            {/* Hanging Silhouette Cat Badge */}
            <div className="absolute -left-6 top-8 z-30 w-12 h-12 bg-[#1b1b1a] rounded-2xl flex items-center justify-center border-2 border-[#f0eee6] shadow-md hover:scale-110 transition-all cursor-pointer">
              <span className="text-2xl text-[#f0eee6]">🐈</span>
            </div>

            {/* Left console panel (decorative controls) */}
            <div className="w-14 bg-[#c4b99a] border-r-4 border-[#1b1b1a] rounded-l-2xl flex flex-col justify-between items-center p-3 relative overflow-hidden">
              <div className="w-4 h-4 rounded-full bg-[#1b1b1a]/20" />
              
              <div className="flex flex-col gap-2 z-10">
                <span className="w-2.5 h-2.5 rounded-full bg-[#30302e]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#30302e]" />
              </div>

              {/* Diagonal offset stripe inside control panel */}
              <div className="w-full h-8 absolute bottom-0 left-0 bg-[#30302e] transform rotate-12 translate-y-4" />
            </div>

            {/* Console Screen Section */}
            <div className="flex-1 bg-[#1b1b1a] rounded-r-2xl border-l-4 border-[#1b1b1a] flex flex-col p-4 relative overflow-hidden">
              
              {/* Screen Body */}
              <div className="flex-1 rounded-xl overflow-hidden border-2 border-[#1b1b1a] bg-[#2a2a28] relative flex items-center justify-center">
                {CONSOLE_IMAGE_PATH ? (
                  <img 
                    src={CONSOLE_IMAGE_PATH} 
                    alt="Console Monitor" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  // Elegant Placeholder indicating where users can load their photo
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center bg-gradient-to-br from-[#4d4c48] to-[#30302e]">
                    <span className="text-3xl mb-1">🖼️</span>
                    <span className="text-[10px] font-mono text-[#c4b99a] uppercase tracking-wider">
                      CONSOLE SCREEN PLACEHOLDER
                    </span>
                    <span className="text-[9px] text-[#87867f] mt-1 font-mono">
                      (Configure CONSOLE_IMAGE_PATH)
                    </span>
                  </div>
                )}
                
                {/* Screen tag name overlay */}
                <div className="absolute inset-x-0 bottom-0 bg-[#1b1b1a]/85 p-3 flex items-center justify-between border-t border-[#1b1b1a]">
                  <div className="flex gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#c4b99a]" />
                    <span className="w-2 h-2 rounded-full bg-[#f0eee6]" />
                  </div>
                  <span className="text-xs font-bold text-[#f0eee6] tracking-widest uppercase">
                    Kaoruko Waguri
                  </span>
                </div>
              </div>

              {/* Bezel details */}
              <div className="flex justify-between items-center pt-3 px-1">
                <div className="flex gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#c4b99a]/50" />
                  <span className="w-2 h-2 rounded-full bg-[#f0eee6]/50" />
                  <span className="w-2 h-2 rounded-full bg-[#4d4c48]" />
                </div>
                <div className="flex gap-1.5">
                  <div className="w-6 h-1 bg-[#4d4c48] rounded-full" />
                  <div className="w-6 h-1 bg-[#4d4c48] rounded-full" />
                </div>
              </div>

            </div>

          </div>

        </div>

        {/* Right Corner: Smooth Wave ClipPaths & Character Placeholder */}
        <div className="absolute bottom-0 right-0 w-[50vw] h-[85vh] pointer-events-none z-10 flex items-end justify-end">
          
          <div className="relative w-full h-full">
            
            {/* Wave layer background utilizing precise SVG paths for smooth bezier curves */}
            <svg 
              className="absolute inset-0 w-full h-full" 
              viewBox="0 0 100 100" 
              preserveAspectRatio="none"
            >
              <defs>
                {/* Custom pattern for retro polka dots */}
                <pattern id="dotPattern" x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse">
                  <circle cx="2" cy="2" r="1.5" fill="#30302e" opacity="0.12" />
                </pattern>
              </defs>

              {/* LAYER 1: Beige background wave with polka dots */}
              <path 
                d="M 100,20 Q 75,35 60,65 T 30,100 L 100,100 Z" 
                fill="#d9d2c5" 
              />
              {/* Overlay path for dots */}
              <path 
                d="M 100,20 Q 75,35 60,65 T 30,100 L 100,100 Z" 
                fill="url(#dotPattern)" 
              />

              {/* Decorative Big circles inside beige wave */}
              <circle cx="70" cy="85" r="3" fill="#30302e" />
              <circle cx="88" cy="90" r="4.5" fill="#30302e" />

              {/* LAYER 2: Dark organic sweeping wave */}
              <path 
                d="M 100,32 Q 80,45 68,72 T 40,100 L 100,100 Z" 
                fill="#30302e" 
              />
            </svg>

            {/* Character Graphic Area */}
            <div className="absolute inset-0 z-20 flex items-end justify-center pointer-events-auto">
              {CHARACTER_IMAGE_PATH ? (
                <img 
                  src={CHARACTER_IMAGE_PATH} 
                  alt="Character Display" 
                  className="h-[90%] object-contain object-bottom transform translate-y-6 hover:translate-y-2 transition-transform duration-500 ease-out"
                />
              ) : (
                // Beautiful layout placeholder when no character image path is set yet
                <div className="w-[50%] h-[75%] mb-6 border-4 border-dashed border-[#f0eee6]/20 rounded-3xl flex flex-col items-center justify-center p-6 text-center bg-[#f0eee6]/5 backdrop-blur-sm shadow-xl">
                  <span className="text-4xl mb-2">👤</span>
                  <span className="text-xs font-bold text-[#f0eee6] uppercase tracking-widest">
                    Character Area
                  </span>
                  <span className="text-[10px] text-[#87867f] mt-2 leading-relaxed max-w-[180px] font-mono">
                    To upload your character, save your image to public and set CHARACTER_IMAGE_PATH in App.jsx.
                  </span>
                </div>
              )}
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};

export default App;

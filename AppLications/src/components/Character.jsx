import React, { useRef, useState } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import charImg from '../../../assets/img/char.png';

gsap.registerPlugin(useGSAP);

const CHARACTER_IMAGE_PATH = charImg; // Cấu hình đường dẫn ảnh nhân vật tại đây

// Inline SVG icons — no external dependency needed
const IconSettings = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const IconHeart = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
  </svg>
);

const IconPower = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2v10" />
    <path d="M18.4 6.6a9 9 0 1 1-12.77.04" />
  </svg>
);
const Character = ({
  characterImage = CHARACTER_IMAGE_PATH,
  onSettings,
  onLike,
  onExit
}) => {
  const containerRef = useRef(null);
  const characterRef = useRef(null);
  const sphere1Ref = useRef(null);
  const sphere2Ref = useRef(null);
  const sphere3Ref = useRef(null);

  const [isOpen, setIsOpen] = useState(false);

  const { contextSafe } = useGSAP({ scope: containerRef });

  const toggleOpen = contextSafe(() => {
    if (!isOpen) {
      const tl = gsap.timeline({ onComplete: () => setIsOpen(true) });

      // 1. Character tilts and slides down first
      tl.to(characterRef.current, {
        y: 40,
        rotation: -3,
        duration: 0.4,
        ease: 'power2.out'
      });

      // 2. Spheres fly out one by one after character settles
      // sphere1=Settings goes high+far left, sphere2=Like middle-left, sphere3=Exit lower-left
      tl.to(sphere1Ref.current, {
        scale: 1,
        opacity: 1,
        x: -300,
        y: -160,
        duration: 0.45,
        ease: 'back.out(1.7)'
      }, '-=0.05')
        .to(sphere2Ref.current, {
          scale: 1,
          opacity: 1,
          x: -360,
          y: -10,
          duration: 0.45,
          ease: 'back.out(1.7)'
        }, '-=0.3')
        .to(sphere3Ref.current, {
          scale: 1,
          opacity: 1,
          x: -300,
          y: 140,
          duration: 0.45,
          ease: 'back.out(1.7)'
        }, '-=0.3');

    } else {
      const tl = gsap.timeline({ onComplete: () => setIsOpen(false) });

      // Spheres spring back with bounce, reverse order
      tl.to(sphere3Ref.current, { scale: 0, opacity: 0, x: 0, y: 0, duration: 0.35, ease: 'back.in(1.5)' })
        .to(sphere2Ref.current, { scale: 0, opacity: 0, x: 0, y: 0, duration: 0.35, ease: 'back.in(1.5)' }, '-=0.25')
        .to(sphere1Ref.current, { scale: 0, opacity: 0, x: 0, y: 0, duration: 0.35, ease: 'back.in(1.5)' }, '-=0.25');

      // Character bounces back up
      tl.to(characterRef.current, {
        y: 0,
        rotation: 0,
        duration: 0.5,
        ease: 'back.out(1.4)'
      }, '-=0.2');
    }
  });

  return (
    <div className="relative w-full h-full flex items-end justify-center pointer-events-none">

      {/* Block 1 — Dome blob behind head (z:1) */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ zIndex: 1 }}
      >
        <path d="M 0,100 C 56 93 30 10 100 10 L 100 100 Z" fill="#30302e" />
      </svg>

      {/* Sphere container (z:2) — same stacking context as character,
          pointer-events-none on wrapper so character click is not blocked.
          Each button re-enables pointer-events-auto individually. */}
      <div
        ref={containerRef}
        className="absolute inset-0 pointer-events-none flex items-center justify-center"
        style={{ zIndex: 2 }}
      >
        <button
          ref={sphere1Ref}
          onClick={onSettings}
          className="absolute w-14 h-14 rounded-full flex items-center justify-center pointer-events-auto
            bg-[#30302e]/90 text-[#e6dfd3] shadow-2xl border border-[#e6dfd3]/10
            backdrop-blur-sm cursor-pointer opacity-0
            hover:bg-[#e6dfd3] hover:text-[#30302e] transition-colors duration-200"
          style={{ scale: 0 }}
          title="Settings"
        >
          <IconSettings />
        </button>
        <button
          ref={sphere2Ref}
          onClick={onLike}
          className="absolute w-14 h-14 rounded-full flex items-center justify-center pointer-events-auto
            bg-[#30302e]/90 text-[#e6dfd3] shadow-2xl border border-[#e6dfd3]/10
            backdrop-blur-sm cursor-pointer opacity-0
            hover:bg-[#e6dfd3] hover:text-[#30302e] transition-colors duration-200"
          style={{ scale: 0 }}
          title="Like"
        >
          <IconHeart />
        </button>
        <button
          ref={sphere3Ref}
          onClick={onExit}
          className="absolute w-14 h-14 rounded-full flex items-center justify-center pointer-events-auto
            bg-[#30302e]/90 text-[#e6dfd3] shadow-2xl border border-[#e6dfd3]/10
            backdrop-blur-sm cursor-pointer opacity-0
            hover:bg-rose-700 hover:text-white transition-colors duration-200"
          style={{ scale: 0 }}
          title="Exit"
        >
          <IconPower />
        </button>
      </div>

      {/* Character image (z:3) — pointer-events-none on wrapper,
          only the <img> itself is clickable so it doesn't block spheres
          that have translated outside its own bounding box. */}
      <div
        className="absolute inset-0 flex items-end justify-center pointer-events-none"
        style={{ zIndex: 3 }}
      >
        {(characterImage || CHARACTER_IMAGE_PATH) ? (
          <img
            ref={characterRef}
            src={characterImage || CHARACTER_IMAGE_PATH}
            alt="Character"
            onClick={toggleOpen}
            className="h-[110%] object-contain object-bottom cursor-pointer pointer-events-auto"
            style={{ filter: 'drop-shadow(0 40px 60px rgba(0, 0, 0, 0.45))' }}
          />
        ) : (
          <div
            onClick={toggleOpen}
            className="mb-8 p-4 border-2 border-dashed border-[#30302e]/30 rounded-xl
              bg-white/50 backdrop-blur-sm text-center cursor-pointer pointer-events-auto"
          >
            <span className="text-sm font-semibold text-[#30302e]">Character Image Placeholder</span>
          </div>
        )}
      </div>

      {/* Block 2 (z:4) */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ zIndex: 4 }}
      >
        <path d="M 0,100 Q 55,96 100,46 L 100,100 Z" fill="#f4f466ff" />
      </svg>

      {/* Block 3 (z:5) */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ zIndex: 5 }}
      >
        <path d="M 0,100 Q 55,100 100,50 L 100,100 Z" fill="#c4b99a" />
      </svg>

      {/* Block 4 (z:6) */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ zIndex: 6 }}
      >
        <path d="M 0,100 Q 60,100 100,75 L 100,100 Z" fill="#30302e" />
      </svg>
    </div>
  );
};

export default Character;

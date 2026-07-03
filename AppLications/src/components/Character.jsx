import React from 'react';
import charImg from '../../../assets/img/char.png';

const CHARACTER_IMAGE_PATH = charImg; // Cấu hình đường dẫn ảnh nhân vật tại đây

const Character = ({ characterImage = CHARACTER_IMAGE_PATH }) => {
  return (
    <div className="relative w-full h-full flex items-end justify-center pointer-events-none">
      {/* Block 1 (Backmost Curved Dome/Blob Layer behind head) */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ zIndex: 1 }}
      >
        <path
          d="M 0,100 C 56 93 30 10 100 10 L 100 100 Z"
          fill="#30302e"
        />
      </svg>

      {/* Character Image (Positioned between Block 1 and Block 2) */}
      <div className="relative z-[2] flex items-end justify-center h-full w-full pointer-events-auto">
        {(characterImage || CHARACTER_IMAGE_PATH) ? (
          <img
            src={characterImage || CHARACTER_IMAGE_PATH}
            alt="Character"
            className="h-[110%] object-contain object-bottom transition-transform duration-500 hover:scale-105"
            style={{ filter: 'drop-shadow(0 40px 60px rgba(0, 0, 0, 0.45))' }}
          />
        ) : (
          <div className="mb-8 p-4 border-2 border-dashed border-[#30302e]/30 rounded-xl bg-white/50 backdrop-blur-sm text-center">
            <span className="text-sm font-semibold text-[#30302e]">Character Image Placeholder</span>
          </div>
        )}
      </div>

      {/* Block 2 (Second Curved Layer) */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ zIndex: 3 }}
      >
        <path
          d="M 0,100 Q 55,96 100,46 L 100,100 Z"
          fill="#f4f466ff"
        />
      </svg>

      {/* Block 3 (Third Curved Layer) */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ zIndex: 4 }}
      >
        <path
          d="M 0,100 Q 55,100 100,50 L 100,100 Z"
          fill="#c4b99a"
        />
      </svg>

      {/* Block 4 (Frontmost Curved Layer - overlays the character) */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ zIndex: 5 }}
      >
        <path
          d="M 0,100 Q 60,100 100,75 L 100,100 Z"
          fill="#30302e"
        />
      </svg>
    </div>
  );
};

export default Character;

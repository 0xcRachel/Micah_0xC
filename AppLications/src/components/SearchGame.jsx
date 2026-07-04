import React, { useState, useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

// Register GSAP hook
gsap.registerPlugin(useGSAP);

export const GAMES_DATA = [
  {
    id: 1,
    title: 'Elden Ring',
    developer: 'FromSoftware, Inc.',
    imageSrc: 'https://cdn.akamai.steamstatic.com/steam/apps/1245620/header.jpg',
    score: 93,
    scoreLabel: 'Very Positive',
    price: '$59.99',
    tags: ['Souls-like', 'RPG', 'Open World']
  },
  {
    id: 2,
    title: 'Portal 2',
    developer: 'Valve',
    imageSrc: 'https://cdn.akamai.steamstatic.com/steam/apps/620/header.jpg',
    score: 98,
    scoreLabel: 'Overwhelmingly Positive',
    price: '$9.99',
    tags: ['Puzzle', 'Co-op', 'Comedy']
  },
  {
    id: 3,
    title: 'Stardew Valley',
    developer: 'ConcernedApe',
    imageSrc: 'https://cdn.akamai.steamstatic.com/steam/apps/413150/header.jpg',
    score: 97,
    scoreLabel: 'Overwhelmingly Positive',
    price: '$14.99',
    tags: ['Farming Sim', 'Relaxing', 'RPG']
  },
  {
    id: 4,
    title: 'Hades',
    developer: 'Supergiant Games',
    imageSrc: 'https://cdn.akamai.steamstatic.com/steam/apps/1145360/header.jpg',
    score: 98,
    scoreLabel: 'Overwhelmingly Positive',
    price: '$24.99',
    tags: ['Rogue-like', 'Action', 'Indie']
  },
  {
    id: 5,
    title: 'Cyberpunk 2077',
    developer: 'CD PROJEKT RED',
    imageSrc: 'https://cdn.akamai.steamstatic.com/steam/apps/1091500/header.jpg',
    score: 83,
    scoreLabel: 'Very Positive',
    price: '$59.99',
    tags: ['Cyberpunk', 'Open World', 'Sci-fi']
  },
  {
    id: 6,
    title: 'Kaoruko Waguri: Days',
    developer: 'VisualArts / Key',
    imageSrc: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=500&auto=format&fit=crop&q=80',
    score: 96,
    scoreLabel: 'Overwhelmingly Positive',
    price: '$19.99',
    tags: ['Visual Novel', 'Anime', 'Story Rich']
  }
];

const SearchGame = ({ onSelectGame, className = '', style = {} }) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  const iconRef = useRef(null);

  const filteredGames = GAMES_DATA.filter((game) =>
    game.title.toLowerCase().includes(query.toLowerCase()) ||
    game.developer.toLowerCase().includes(query.toLowerCase()) ||
    game.tags.some((t) => t.toLowerCase().includes(query.toLowerCase()))
  );

  // Focus/Blur effects with GSAP
  useGSAP(() => {
    if (isOpen) {
      // Animate dropdown list container sliding down
      gsap.fromTo(dropdownRef.current,
        { opacity: 0, y: -10, scaleY: 0.95 },
        { opacity: 1, y: 0, scaleY: 1, duration: 0.25, ease: 'back.out(1.2)' }
      );
      // Animate item list staggered entry
      const items = dropdownRef.current?.querySelectorAll('.search-item');
      if (items && items.length > 0) {
        gsap.fromTo(items,
          { opacity: 0, x: -15 },
          { opacity: 1, x: 0, duration: 0.2, stagger: 0.04, ease: 'power2.out' }
        );
      }
      // Spin Search icon slightly
      gsap.to(iconRef.current, { rotation: 90, scale: 1.1, color: '#30302e', duration: 0.3 });
    } else {
      gsap.to(iconRef.current, { rotation: 0, scale: 1, color: '#87867f', duration: 0.2 });
    }
  }, { dependencies: [isOpen, query], scope: containerRef });

  const handleFocus = () => setIsOpen(true);
  const handleBlur = () => {
    // Delay blur slightly to allow clicks to go through to list items
    setTimeout(() => setIsOpen(false), 200);
  };

  const handleItemClick = (game) => {
    onSelectGame(game);
    setQuery('');
    setIsOpen(false);

    // Bounce interaction on input
    gsap.timeline()
      .to(inputRef.current, { scale: 0.96, duration: 0.1 })
      .to(inputRef.current, { scale: 1, duration: 0.15, ease: 'elastic.out(1.2)' });
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${className}`}
      style={{
        fontFamily: "'Outfit', 'Segoe UI', sans-serif",
        userSelect: 'none',
        ...style
      }}
    >
      {/* Input container */}
      <div
        ref={inputRef}
        style={{
          display: 'flex',
          alignItems: 'center',
          background: '#faf9f6',
          border: '2px solid #30302e',
          borderRadius: '16px',
          padding: '8px 16px',
          boxShadow: '0 4px 0 #30302e',
          transition: 'box-shadow 0.2s, transform 0.2s',
        }}
        className="hover:translate-y-[-2px] hover:shadow-[0_6px_0_#30302e] active:translate-y-[2px] active:shadow-[0_2px_0_#30302e]"
      >
        {/* Search icon */}
        <span ref={iconRef} style={{ display: 'inline-flex', marginRight: '10px', color: '#87867f' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </span>

        {/* Input */}
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder="Search Steam Games (e.g. Elden Ring, Portal 2...)"
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontFamily: 'inherit',
            fontSize: '14px',
            color: '#30302e',
            fontWeight: '500',
          }}
        />

        {/* Clear Button */}
        {query && (
          <button
            onClick={() => setQuery('')}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#87867f',
              padding: '2px',
              display: 'inline-flex',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* Dropdown search results */}
      {isOpen && filteredGames.length > 0 && (
        <div
          ref={dropdownRef}
          style={{
            position: 'absolute',
            top: 'calc(100% + 12px)',
            left: 0,
            right: 0,
            background: '#faf9f6',
            border: '2px solid #30302e',
            borderRadius: '16px',
            boxShadow: '0 8px 24px rgba(48,48,46,0.12), 0 6px 0 #30302e',
            zIndex: 100,
            maxHeight: '260px',
            overflowY: 'auto',
            transformOrigin: 'top center',
            padding: '8px',
          }}
          className="thin-scrollbar"
        >
          {filteredGames.map((game) => (
            <div
              key={game.id}
              onClick={() => handleItemClick(game)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '8px 12px',
                borderRadius: '10px',
                cursor: 'pointer',
                transition: 'background-color 0.2s',
              }}
              className="search-item hover:bg-[#ede9e3]"
            >
              {/* Game thumbnail image */}
              <img
                src={game.imageSrc}
                alt={game.title}
                style={{
                  width: '50px',
                  height: '28px',
                  objectFit: 'cover',
                  borderRadius: '4px',
                  border: '1px solid #ddd8ce',
                }}
              />
              {/* Game info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#30302e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {game.title}
                </div>
                <div style={{ fontSize: '10px', color: '#87867f', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {game.developer}
                </div>
              </div>
              {/* Game score badge */}
              <div style={{
                background: game.score >= 80 ? '#4d9e6a' : '#c49a3a',
                color: '#fff',
                fontSize: '10px',
                fontWeight: '800',
                padding: '2px 6px',
                borderRadius: '4px',
              }}>
                {game.score}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SearchGame;

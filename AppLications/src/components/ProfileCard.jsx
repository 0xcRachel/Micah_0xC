import React, { useRef, useState } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

// Register GSAP hook
gsap.registerPlugin(useGSAP);

/**
 * GameCard (ProfileCard) — Steam-style game info card with animations
 */
const scoreColor = (s) =>
  s >= 80 ? '#4d9e6a' : s >= 60 ? '#c49a3a' : '#b85040';

const GameCard = ({
  title      = 'Game Title',
  developer  = 'Studio Name',
  imageSrc   = '',
  score      = 88,
  scoreLabel = 'Very Positive',
  price      = '$29.99',
  tags       = ['Adventure', 'RPG', 'Story Rich'],
  className  = '',
  style      = {},
  onClick,
  // backward compat
  name,
  subtitle,
}) => {
  const currentTitle = title !== 'Game Title' ? title : (name || title);
  const currentDev = developer !== 'Studio Name' ? developer : (subtitle || developer);

  // Local state to hold the currently rendered game info for OUT/IN transitions
  const [displayGame, setDisplayGame] = useState({
    title: currentTitle,
    developer: currentDev,
    imageSrc,
    score,
    scoreLabel,
    price,
    tags
  });

  const cardRef = useRef(null);
  const firstUpdate = useRef(true);

  const sc = Math.max(0, Math.min(100, displayGame.score));
  const sColor = scoreColor(sc);
  const visibleTags = displayGame.tags.slice(0, 3);

  // GSAP out-and-in transition animation when game props update
  useGSAP(() => {
    if (firstUpdate.current) {
      firstUpdate.current = false;
      return;
    }

    const tlOut = gsap.timeline({
      onComplete: () => {
        setDisplayGame({
          title: currentTitle,
          developer: currentDev,
          imageSrc,
          score,
          scoreLabel,
          price,
          tags
        });

        const tlIn = gsap.timeline({ defaults: { ease: 'power3.out' } });
        tlIn.fromTo(cardRef.current, { scale: 0.98 }, { scale: 1, duration: 0.3 });
        tlIn.fromTo('.left-panel', { opacity: 0, x: -10 }, { opacity: 1, x: 0, duration: 0.35 });
        tlIn.fromTo('.score-ring', { scale: 0.7, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.45, ease: 'back.out(1.4)' }, '-=0.2');
        tlIn.fromTo('.game-image-container', { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4 }, '-=0.25');
        tlIn.fromTo('.info-element', { y: 8, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, stagger: 0.04 }, '-=0.25');
      }
    });

    tlOut.to('.info-element', { y: -8, opacity: 0, duration: 0.15, stagger: 0.02 });
    tlOut.to('.game-image-container', { y: -10, opacity: 0, duration: 0.15 }, '-=0.1');
    tlOut.to('.score-ring', { scale: 0.7, opacity: 0, duration: 0.15 }, '-=0.1');
    tlOut.to('.left-panel', { opacity: 0, x: -10, duration: 0.2 }, '-=0.1');
    tlOut.to(cardRef.current, { scale: 0.98, duration: 0.2 }, '-=0.15');

  }, { dependencies: [currentTitle, currentDev, imageSrc, score, scoreLabel, price, tags], scope: cardRef });

  // Initial mount animations
  useGSAP(() => {
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.fromTo(cardRef.current, { scale: 0.96, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4 });
    tl.fromTo('.left-panel', { opacity: 0, x: -10 }, { opacity: 1, x: 0, duration: 0.4 }, '-=0.2');
    tl.fromTo('.score-ring', { scale: 0.7, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(1.4)' }, '-=0.2');
    tl.fromTo('.game-image-container', { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4 }, '-=0.3');
    tl.fromTo('.info-element', { y: 8, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, stagger: 0.04 }, '-=0.3');
  }, { scope: cardRef });

  return (
    <div
      ref={cardRef}
      className={className}
      onClick={onClick}
      style={{
        display: 'flex',
        borderRadius: '20px',
        overflow: 'hidden',
        background: '#faf9f6',
        border: '2px solid #30302e',
        boxShadow: '0 6px 0 #30302e, 0 12px 28px rgba(48,48,46,0.08)',
        userSelect: 'none',
        fontFamily: "'Outfit', 'Segoe UI', sans-serif",
        minHeight: '200px',
        cursor: onClick ? 'pointer' : 'default',
        transformOrigin: 'center center',
        ...style,
      }}
    >
      {/* ── Left score panel (styled to match light theme) ── */}
      <div
        className="left-panel"
        style={{
          width: '105px',
          flexShrink: 0,
          background: '#f0eee6', // Soft light beige instead of dark grey
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '4px',
          padding: '12px 6px',
          borderRight: '2px solid #30302e',
        }}
      >
        {/* Score circle */}
        <div
          className="score-ring"
          style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            border: `3px solid ${sColor}`,
            background: '#faf9f6', // Clean light background
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
          }}
        >
          <span style={{
            fontSize: '22px',
            fontWeight: '900',
            color: '#30302e',
            lineHeight: 1,
          }}>{sc}</span>
        </div>

        {/* Divider */}
        <div style={{
          width: '48px',
          height: '1.5px',
          background: '#30302e',
          opacity: 0.15,
          margin: '4px 0',
        }} />

        {/* Score label */}
        <span style={{
          fontSize: '9px',
          fontWeight: '800',
          color: sColor,
          textAlign: 'center',
          letterSpacing: '0.2px',
          lineHeight: 1.2,
          maxWidth: '85px',
        }}>
          {displayGame.scoreLabel}
        </span>

        {/* "REVIEW" */}
        <span style={{
          fontSize: '7px',
          fontWeight: '800',
          color: '#87867f',
          letterSpacing: '1px',
          marginTop: '2px',
        }}>REVIEW</span>
      </div>

      {/* ── Banner image (optimized width to give info section more space) ── */}
      <div
        className="game-image-container"
        style={{
          width: '185px', // Reduced from 240px to prevent squeezing the right side
          height: '172px', // Fixed height to prevent vertical stretching
          flexShrink: 0,
          margin: '12px 0 12px 12px',
          borderRadius: '14px',
          overflow: 'hidden',
          border: '2px solid #30302e',
          background: '#e8e3db',
          position: 'relative',
        }}
      >
        {displayGame.imageSrc ? (
          <img
            src={displayGame.imageSrc}
            alt={displayGame.title}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        ) : (
          <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#b0a99e',
            fontSize: '11px',
            flexDirection: 'column',
            gap: '6px',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
              stroke="#c4b99a" strokeWidth="1.8">
              <rect x="3" y="3" width="18" height="18" rx="3"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <path d="M21 15l-5-5L5 21"/>
            </svg>
            <span>No Image</span>
          </div>
        )}
      </div>

      {/* ── Info area ─────────────────────────────────────── */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        padding: '14px 16px 14px 14px',
        minWidth: 0,
      }}>
        {/* Title */}
        <div
          className="info-element"
          style={{
            fontSize: '17px',
            fontWeight: '900',
            color: '#30302e',
            letterSpacing: '0.1px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {displayGame.title}
        </div>

        {/* Developer */}
        <div
          className="info-element"
          style={{
            fontSize: '11px',
            fontWeight: '500',
            color: '#87867f',
            marginTop: '3px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {displayGame.developer}
        </div>

        {/* Divider */}
        <div
          className="info-element"
          style={{
            height: '1.5px',
            background: '#30302e',
            opacity: 0.15,
            margin: '10px 0',
          }}
        />

        {/* Tags (clean style, wraps beautifully) */}
        <div
          className="info-element"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '5px',
            flex: 1,
            alignContent: 'flex-start',
          }}
        >
          {visibleTags.map((tag, i) => (
            <span key={i} style={{
              background: '#f0eee6',
              color: '#30302e',
              border: '1.5px solid #30302e',
              fontSize: '10px',
              fontWeight: '700',
              padding: '3px 8px',
              borderRadius: '99px',
              whiteSpace: 'nowrap',
            }}>
              {tag}
            </span>
          ))}
        </div>

        {/* Bottom row: Price badge + Steam label (never overlaps now due to more space) */}
        <div
          className="info-element"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: '8px',
          }}
        >
          {/* Price badge */}
          <span style={{
            background: '#30302e',
            color: '#faf9f6',
            fontSize: '12px',
            fontWeight: '800',
            padding: '4px 12px',
            borderRadius: '6px',
          }}>
            {displayGame.price}
          </span>

          {/* Steam Label (compact, elegant) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {/* Soft green online indicator */}
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#4d9e6a' }} />
            <span style={{
              fontSize: '8.5px',
              color: '#87867f',
              fontWeight: '800',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}>
              Steam Platform
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameCard;

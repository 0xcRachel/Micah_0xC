import React, { useRef, useState } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { openInBrowser } from '../api';
import './ForceUpdate.css';

gsap.registerPlugin(useGSAP);

/**
 * ForceUpdate — Full-screen overlay that blocks the entire application
 * when the user's version is below the minimum required version.
 *
 * Props:
 *   versionInfo  – object returned by checkVersionRequirement()
 *   isOptional   – if true, shows a "Skip" button (optional update)
 */
const ForceUpdate = ({ versionInfo, isOptional }) => {
  const containerRef = useRef(null);
  const cardRef = useRef(null);
  const badgeRef = useRef(null);
  const titleRef = useRef(null);
  const subtitleRef = useRef(null);
  const notesRef = useRef(null);
  const actionsRef = useRef(null);
  const pulseRef = useRef(null);

  const [downloading, setDownloading] = useState(false);

  // Entry animation sequence
  useGSAP(() => {
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

    // 1. Backdrop fades in
    tl.fromTo(
      containerRef.current.querySelector('.fu-backdrop'),
      { opacity: 0 },
      { opacity: 1, duration: 0.5 },
    );

    // 2. Card scales + fades in with slight bounce
    tl.fromTo(
      cardRef.current,
      { opacity: 0, scale: 0.85, y: 40 },
      { opacity: 1, scale: 1, y: 0, duration: 0.6, ease: 'back.out(1.4)' },
      '-=0.2',
    );

    // 3. Warning badge slides down
    tl.fromTo(
      badgeRef.current,
      { opacity: 0, y: -20, scale: 0.5 },
      { opacity: 1, y: 0, scale: 1, duration: 0.45, ease: 'elastic.out(1, 0.5)' },
      '-=0.35',
    );

    // 4. Title + subtitle stagger in from left
    tl.fromTo(
      [titleRef.current, subtitleRef.current],
      { opacity: 0, x: -30 },
      { opacity: 1, x: 0, duration: 0.4, stagger: 0.1 },
      '-=0.25',
    );

    // 5. Release notes fade up
    if (notesRef.current) {
      tl.fromTo(
        notesRef.current,
        { opacity: 0, y: 16 },
        { opacity: 1, y: 0, duration: 0.35 },
        '-=0.15',
      );
    }

    // 6. Action buttons slide up
    tl.fromTo(
      actionsRef.current,
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.4 },
      '-=0.2',
    );

    // 7. Start pulsing the download button
    tl.add(() => {
      gsap.to(pulseRef.current, {
        boxShadow: '0 0 30px rgba(224, 85, 85, 0.45), 0 10px 0 #1b1b1a, 0 20px 40px rgba(0,0,0,0.12)',
        duration: 1.2,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      });
    }, '-=0.1');
  }, { scope: containerRef });

  const handleDownload = async () => {
    if (downloading || !versionInfo?.download_url) return;
    setDownloading(true);

    // Animate button press
    gsap.to(pulseRef.current, {
      scale: 0.95,
      duration: 0.1,
      yoyo: true,
      repeat: 1,
    });

    try {
      await openInBrowser(versionInfo.download_url);
    } catch {
      // Fallback: open in default browser via window
      window.open(versionInfo.download_url, '_blank');
    }
  };

  const handleClose = () => {
    const tl = gsap.timeline({
      onComplete: () => window.close(),
    });

    tl.to(cardRef.current, {
      opacity: 0,
      scale: 0.9,
      y: 30,
      duration: 0.3,
      ease: 'power2.in',
    });

    tl.to(
      containerRef.current.querySelector('.fu-backdrop'),
      { opacity: 0, duration: 0.2 },
      '-=0.15',
    );
  };

  return (
    <div ref={containerRef} className="fu-container">
      {/* Dark overlay backdrop */}
      <div className="fu-backdrop" />

      {/* Card */}
      <div ref={cardRef} className="fu-card">
        {/* Warning badge with pulse ring */}
        <div className="fu-badge-wrap">
          <div ref={badgeRef} className="fu-badge">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <div className="fu-pulse-ring" />
        </div>

        {/* Title */}
        <h1 ref={titleRef} className="fu-title">
          {isOptional ? 'Update Available' : 'Update Required'}
        </h1>

        {/* Subtitle */}
        <p ref={subtitleRef} className="fu-subtitle">
          {isOptional
            ? 'A new version is available. You can continue using the app or update now.'
            : 'Your version is no longer supported. Please update to continue using the app.'}
        </p>

        {/* Version info */}
        <div className="fu-version-row">
          <span className="fu-version-label">Current</span>
          <span className="fu-version-value fu-version-old">{versionInfo?.current_version ?? '—'}</span>
          <span className="fu-version-separator">→</span>
          <span className="fu-version-label">Latest</span>
          <span className="fu-version-value fu-version-new">{versionInfo?.latest_version ?? '—'}</span>
        </div>

        {/* Release notes */}
        {versionInfo?.release_notes && (
          <div ref={notesRef} className="fu-notes">
            <p className="fu-notes-title">Release Notes</p>
            <p className="fu-notes-text">{versionInfo.release_notes}</p>
          </div>
        )}

        {/* Actions */}
        <div ref={actionsRef} className="fu-actions">
          <button
            ref={pulseRef}
            className="fu-btn fu-btn-primary"
            onClick={handleDownload}
            disabled={downloading}
          >
            {downloading ? (
              <span className="fu-spinner" />
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 8 }}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download Update
              </>
            )}
          </button>

          {isOptional && (
            <button className="fu-btn fu-btn-secondary" onClick={handleClose}>
              Skip for Now
            </button>
          )}
        </div>

        {/* Footer */}
        <p className="fu-footer">
          Micah 0xC · version check
        </p>
      </div>
    </div>
  );
};

export default ForceUpdate;

import React, { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

const LikePage = ({ onBack }) => {
  const pageRef = useRef(null);
  const contentRef = useRef(null);

  // Enter: scale up + fade in
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.fromTo(pageRef.current,
      { opacity: 0 },
      { opacity: 1, duration: 0.3, ease: 'power2.out' }
    );
    tl.fromTo(contentRef.current,
      { scale: 0.88, opacity: 0, y: 30 },
      { scale: 1, opacity: 1, y: 0, duration: 0.5, ease: 'back.out(1.7)' },
      '-=0.1'
    );
  }, { scope: pageRef });

  const handleBack = () => {
    const tl = gsap.timeline({ onComplete: onBack });
    tl.to(contentRef.current, { scale: 0.88, opacity: 0, y: 30, duration: 0.3, ease: 'power2.in' });
    tl.to(pageRef.current, { opacity: 0, duration: 0.2, ease: 'power2.in' }, '-=0.15');
  };

  return (
    <div
      ref={pageRef}
      className="fixed inset-0 z-40 flex items-center justify-center"
    >
      {/* Blurred background overlay */}
      <div className="absolute inset-0 bg-[var(--bg-grid)]/80 backdrop-blur-sm" />

      {/* Page Content */}
      <div
        ref={contentRef}
        className="relative z-10 w-full max-w-md mx-4"
      >
        {/* Back Button */}
        <button
          onClick={handleBack}
          className="mb-6 flex items-center gap-2 text-sm font-semibold text-[var(--text-muted)]
            hover:text-[var(--text-color)] transition-colors duration-200 cursor-pointer group"
        >
          <span className="inline-block transition-transform duration-200 group-hover:-translate-x-1">←</span>
          Back
        </button>

        {/* Card */}
        <div
          className="bg-[var(--card-bg)] border border-[var(--card-border)]/20 rounded-3xl p-10 shadow-2xl text-center"
          style={{ boxShadow: '0 24px 64px rgba(0,0,0,var(--shadow-opacity))' }}
        >
          <h1 className="text-3xl font-black text-[var(--text-color)] tracking-wide mb-3">
            Thanks You!
          </h1>
          <p className="text-sm text-[var(--text-muted)] leading-relaxed mb-8">
 Thank you for loving the app.<br />
            Your support means the world to us.         
      </p>

          <a
            href="https://github.com/0xcRachel"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-[var(--text-color)] text-[var(--bg-color)] rounded-2xl px-6 py-3
              text-sm font-bold tracking-wide hover:bg-[#f4f466ff] hover:text-[var(--text-color)]
              transition-all duration-200 cursor-pointer"
          >
            Star on GitHub
          </a>

          <p className="text-xs text-[var(--text-muted)] mt-8 font-mono">v1.0.0</p>
        </div>
      </div>
    </div>
  );
};

export default LikePage;

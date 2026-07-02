import React, { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

/**
 * IntroOverlay — cinematic multi-stripe time-lapse curtain reveal
 * ──────────────────────────────────────────────────────────────────
 * Features a high-end dynamic text sequence where title characters
 * are split in the React render loop and staggered in one-by-one.
 */

const DEFAULT_STRIPES = [
  { bg: '#f0eee6' },  // 0 — warm cream
  { bg: '#c4b99a' },  // 1 — warm sand
  { bg: '#87867f' },  // 2 — olive gray
  { bg: '#4d4c48' },  // 3 — dark warm gray
  { bg: '#30302e' },  // 4 — near-black olive
];

const DEFAULT_STEPS = [
  {
    title: 'WELCOME',
    hold: 1.2,
  },
  {
    title: 'Micah_0xC',
    subtitle: 'A launcher built for YOU',
    hold: 1.0,
    enter: { ease: 'power3.out' },
  },
  {
    title: 'made by 0xcRachel',
    subtitle: 'Enjoy using the launcher',
    hold: 1.0,
    enter: { ease: 'elastic.out(1, 0.4)', duration: 0.8 },
  },
];

const IntroOverlay = ({
  onComplete,
  onCovered,
  stripes = DEFAULT_STRIPES,
  steps = DEFAULT_STEPS,
}) => {
  const overlayRef = useRef(null);
  const barsRef = useRef([]);
  const stepRefs = useRef([]);

  useGSAP(() => {
    const bars = barsRef.current.filter(Boolean);
    const tl = gsap.timeline({
      defaults: { ease: 'expo.out', overwrite: 'auto' },
      onComplete: () => onComplete?.(),
    });

    // ── 0. Initial state ──
    gsap.set(bars, { xPercent: -100, skewX: 0 });
    stepRefs.current.forEach(stepEl => {
      if (stepEl) gsap.set(stepEl, { autoAlpha: 0, y: 0 });
    });

    // ── ① Bars slide IN ──
    tl.to(bars, {
      xPercent: 0,
      skewX: -6,
      duration: 0.65,
      ease: 'power4.in',
      stagger: { each: 0.1, from: 'start' },
    });

    tl.to(bars, {
      skewX: 0,
      duration: 0.55,
      ease: 'expo.out',
      stagger: { each: 0.1, from: 'start' },
      onComplete: () => onCovered?.(),
    }, '<0.3');

    // ── ② Text Sequence (Character Stagger Reveal) ──
    steps.forEach((step, idx) => {
      const isFirst = idx === 0;
      const stepEl = stepRefs.current[idx];
      if (!stepEl) return;

      // Bring step container to visibility
      tl.set(stepEl, { autoAlpha: 1, y: 0 }, isFirst ? '-=0.1' : '>');

      // Animate character nodes one by one
      const enterDur = step.enter?.duration ?? 0.8;
      const enterEase = step.enter?.ease ?? (isFirst ? 'back.out(1.8)' : 'power3.out');

      tl.fromTo(`.title-char-${idx}`,
        {
          yPercent: 110,
          rotationZ: 10,
          autoAlpha: 0
        },
        {
          yPercent: 0,
          rotationZ: 0,
          autoAlpha: 1,
          duration: enterDur,
          ease: enterEase,
          stagger: 0.04, // elegant wave stagger
        },
        '<'
      );

      // Animate subtitle expanding tracking + fading in
      if (step.subtitle) {
        tl.fromTo(`.subtitle-${idx}`,
          {
            autoAlpha: 0,
            y: 10,
            letterSpacing: '0.1em'
          },
          {
            autoAlpha: 1,
            y: 0,
            letterSpacing: '0.3em',
            duration: enterDur * 0.9,
            ease: 'power3.out'
          },
          '<=0.15'
        );
      }

      // Exit current step (slide up + fade)
      const exitY = step.exit?.y ?? -20;
      const exitDur = step.exit?.duration ?? 0.45;
      const exitEase = step.exit?.ease ?? 'power4.in';

      tl.to(stepEl, {
        autoAlpha: 0,
        y: exitY,
        duration: exitDur,
        ease: exitEase,
      }, `+=${step.hold}`);
    });

    // ── ③ Bars slide OUT ──
    tl.to(bars, {
      skewX: 6,
      duration: 0.3,
      ease: 'power2.in',
      stagger: { each: 0.09, from: 'end' },
    }, '+=0.02');

    tl.to(bars, {
      xPercent: 100,
      skewX: 0,
      duration: 0.62,
      ease: 'expo.inOut',
      stagger: { each: 0.09, from: 'end' },
    }, '<0.15');

    // ── ④ Hide overlay ──
    tl.set(overlayRef.current, { display: 'none' });
  }, { scope: overlayRef });

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 overflow-hidden"
      aria-hidden="true"
    >
      {/* Background Bars */}
      {stripes.map((stripe, i) => (
        <div
          key={i}
          ref={el => { barsRef.current[i] = el; }}
          className="absolute inset-0 w-full h-full will-change-transform"
          style={{ backgroundColor: stripe.bg }}
        />
      ))}

      {/* Text Container */}
      <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none select-none">
        {steps.map((step, stepIdx) => (
          <div
            key={stepIdx}
            ref={el => { stepRefs.current[stepIdx] = el; }}
            className="absolute flex flex-col items-center justify-center gap-5 w-full text-center px-4"
          >
            {/* Title with split characters */}
            <h2 className="text-5xl md:text-6xl font-black tracking-[0.25em] text-[#141413] uppercase flex flex-wrap justify-center overflow-hidden py-2">
              {step.title.split('').map((char, charIdx) => (
                <span
                  key={charIdx}
                  className="inline-block overflow-hidden vertical-align-bottom"
                >
                  <span
                    className={`inline-block title-char-${stepIdx} transform-gpu`}
                    style={{ display: 'inline-block' }}
                  >
                    {char === ' ' ? '\u00A0' : char}
                  </span>
                </span>
              ))}
            </h2>

            {/* Subtitle */}
            {step.subtitle && (
              <p className={`subtitle-${stepIdx} text-xs md:text-sm text-[#87867f] font-mono uppercase transform-gpu`}>
                {step.subtitle}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default IntroOverlay;

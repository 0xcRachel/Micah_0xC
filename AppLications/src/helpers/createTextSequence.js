import gsap from 'gsap';

/**
 * createTextSequence
 * ──────────────────────────────────────────────────────────────
 * Appends a highly polished cinematic reveal to a GSAP timeline.
 * Uses clip-path mask reveals and subtle transformations.
 * This is 100% layout-safe and does not break typography or tracking.
 *
 * @param {gsap.core.Timeline} tl    – GSAP Timeline to append to
 * @param {Object}             refs  – DOM element refs
 * @param {HTMLElement}        refs.title    – Title element
 * @param {HTMLElement}        refs.subtitle – Subtitle element (optional)
 * @param {Array}              steps – Sequence steps
 */
export function createTextSequence(tl, refs, steps) {
  const { title, subtitle } = refs;

  // Initialize initial states immediately on script run to avoid FOUC
  if (title) {
    gsap.set(title, { 
      clipPath: 'polygon(0% 100%, 100% 100%, 100% 100%, 0% 100%)',
      y: 30,
      skewY: 3
    });
  }
  if (subtitle) {
    gsap.set(subtitle, { 
      clipPath: 'polygon(0% 100%, 100% 100%, 100% 100%, 0% 100%)',
      y: 15,
      letterSpacing: '0.1em'
    });
  }

  steps.forEach((step, i) => {
    const isFirst = i === 0;
    const hasSubtitle = !!step.subtitle;

    // ── Set text content at the start of the step ──
    tl.call(() => {
      if (title)    title.textContent = step.title || '';
      if (subtitle) subtitle.textContent = step.subtitle || '';
    });

    // ── Entrance animation ──
    const enterDur  = step.enter?.duration ?? 0.85;
    const enterEase = step.enter?.ease     ?? (isFirst ? 'back.out(1.4)' : 'power4.out');

    // Title reveal: slides up, skews back to 0, and unmasks via clipPath
    if (title) {
      tl.fromTo(title,
        { 
          autoAlpha: 0,
          y: 35,
          skewY: 4,
          clipPath: 'polygon(0% 100%, 100% 100%, 100% 100%, 0% 100%)'
        },
        { 
          autoAlpha: 1,
          y: 0,
          skewY: 0,
          clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)',
          duration: enterDur, 
          ease: enterEase,
        }
      );
    }

    // Subtitle reveal: tracking expansion + clipPath unmask
    if (subtitle && hasSubtitle) {
      tl.fromTo(subtitle,
        { 
          autoAlpha: 0,
          y: 15,
          letterSpacing: '0.15em',
          clipPath: 'polygon(0% 100%, 100% 100%, 100% 100%, 0% 100%)'
        },
        { 
          autoAlpha: 1,
          y: 0,
          letterSpacing: '0.3em',
          clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)',
          duration: enterDur * 0.9, 
          ease: 'power3.out' 
        },
        '<=0.12' // overlap slightly with title reveal
      );
    } else if (subtitle) {
      tl.set(subtitle, { autoAlpha: 0 });
    }

    // ── Hold duration ──
    const hold = step.hold ?? 1.2;

    // ── Exit animation ──
    const exitDur  = step.exit?.duration ?? 0.45;
    const exitEase = step.exit?.ease     ?? 'power4.in';
    const exitY    = step.exit?.y        ?? -25;

    // Mask exit: slide up while clipPath masks the top
    const visibleEls = [];
    if (title) visibleEls.push(title);
    if (subtitle && hasSubtitle) visibleEls.push(subtitle);

    if (visibleEls.length > 0) {
      tl.to(visibleEls, {
        autoAlpha: 0,
        y: exitY,
        clipPath: 'polygon(0% 0%, 100% 0%, 100% 0%, 0% 0%)',
        duration: exitDur,
        ease: exitEase,
        stagger: 0.05,
      }, `+=${hold}`);
    }
  });
}

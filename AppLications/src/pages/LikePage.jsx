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
      <div className="absolute inset-0 bg-[#f9f8f4]/80 backdrop-blur-sm" />

      {/* Page Content */}
      <div
        ref={contentRef}
        className="relative z-10 w-full max-w-md mx-4"
      >
        {/* Back Button */}
        <button
          onClick={handleBack}
          className="mb-6 flex items-center gap-2 text-sm font-semibold text-[#87867f]
            hover:text-[#30302e] transition-colors duration-200 cursor-pointer group"
        >
          <span className="inline-block transition-transform duration-200 group-hover:-translate-x-1">←</span>
          Back
        </button>

        {/* Card */}
        <div
          className="bg-[#f9f8f4] border border-[#e6dfd3] rounded-3xl p-10 shadow-2xl text-center"
          style={{ boxShadow: '0 24px 64px rgba(48,48,46,0.12)' }}
        >
          <h1 className="text-3xl font-black text-[#30302e] tracking-wide mb-3">
            Cảm ơn bạn!
          </h1>
          <p className="text-sm text-[#87867f] leading-relaxed mb-8">
            Cảm ơn bạn đã yêu thích ứng dụng.<br />
            Mọi sự ủng hộ của bạn đều có ý nghĩa với chúng tôi.
          </p>

          <a
            href="https://github.com/0xcRachel"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-[#30302e] text-[#e6dfd3] rounded-2xl px-6 py-3
              text-sm font-bold tracking-wide hover:bg-[#f4f466ff] hover:text-[#30302e]
              transition-all duration-200 cursor-pointer"
          >
            Star on GitHub
          </a>

          <p className="text-xs text-[#c4b99a] mt-8 font-mono">v1.0.0</p>
        </div>
      </div>
    </div>
  );
};

export default LikePage;

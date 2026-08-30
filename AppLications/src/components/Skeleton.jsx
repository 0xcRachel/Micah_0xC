import React from 'react';

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const Skeleton = ({ width = '100%', height = 14, rounded = 4, className = '', lines = 1 }) => {
  if (lines > 1) {
    return (
      <div className={`flex flex-col gap-2 ${className}`}>
        {Array.from({ length: lines }, (_, i) => (
          <span
            key={i}
            className={`block skeleton-shimmer ${prefersReducedMotion ? 'skeleton-static' : ''}`}
            style={{
              width: i === lines - 1 ? '60%' : width,
              height,
              borderRadius: rounded,
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <span
      className={`block skeleton-shimmer ${prefersReducedMotion ? 'skeleton-static' : ''} ${className}`}
      style={{ width, height, borderRadius: rounded }}
    />
  );
};

export default Skeleton;

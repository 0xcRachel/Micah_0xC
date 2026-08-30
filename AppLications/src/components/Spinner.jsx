import React from 'react';

const Spinner = ({ size = 12, className = '', label = 'loading' }) => (
  <span
    className={`inline-block rounded-full border-2 border-current border-t-transparent animate-spin shrink-0 ${className}`}
    style={{ width: size, height: size }}
    aria-label={label}
  />
);

export default Spinner;

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import '../styles/Toast.css';

export const Toast = ({ toast }) =>
  toast
    ? createPortal(
        <div className="app-toast-wrap">
          <div
            key={toast.id}
            className={`app-toast ${toast.type}${toast.phase === 'leave' ? ' app-toast-leave' : ''}`}
          >
            {toast.message}
          </div>
        </div>,
        document.body
      )
    : null;

export const useToast = () => {
  const [toast, setToast] = useState(null);
  const idRef = useRef(0);
  const timersRef = useRef([]);

  const hide = useCallback(() => {
    // Play the out animation, then remove from the DOM.
    setToast((t) => (t ? { ...t, phase: 'leave' } : t));
    timersRef.current.push(setTimeout(() => setToast(null), 320));
  }, []);

  const show = useCallback((msg, type = 'success', ms = 3200) => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    idRef.current += 1;
    setToast({ message: msg, type, phase: 'enter', id: idRef.current });
    timersRef.current.push(setTimeout(hide, ms));
  }, [hide]);

  useEffect(() => () => timersRef.current.forEach(clearTimeout), []);
  return { toast, show };
};

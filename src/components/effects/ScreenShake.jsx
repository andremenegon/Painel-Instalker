import { useEffect } from 'react';

export default function ScreenShake({ trigger }) {
  useEffect(() => {
    if (!trigger) return;

    const root = document.documentElement;
    root.style.animation = 'shake 0.5s ease-in-out';
    
    const timer = setTimeout(() => {
      root.style.animation = '';
    }, 500);

    return () => {
      clearTimeout(timer);
      root.style.animation = '';
    };
  }, [trigger]);

  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes shake {
        0%, 100% { transform: translateX(0); }
        10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
        20%, 40%, 60%, 80% { transform: translateX(5px); }
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  return null;
}
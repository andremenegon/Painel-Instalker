import React, { useEffect, useMemo, useState } from 'react';

const COLORS = ['#FF6B4A', '#F97316', '#FACC15', '#34D399', '#38BDF8', '#A855F7'];

export default function Confetti({ show, onComplete }) {
  const [primary, setPrimary] = useState([]);
  const [secondary, setSecondary] = useState([]);

  const totalPrimary = useMemo(() => 110 + Math.floor(Math.random() * 20), [show]);
  const totalSecondary = useMemo(() => 60 + Math.floor(Math.random() * 20), [show]);

  useEffect(() => {
    if (!show) {
      setPrimary([]);
      setSecondary([]);
      return;
    }

    const makePiece = (index, slow = false) => {
      const width = slow ? 10 + Math.random() * 6 : 6 + Math.random() * 6;
      return {
        id: index,
        left: Math.random() * 100,
        animationDelay: Math.random() * 0.8,
        animationDuration: slow ? 3.6 + Math.random() * 1.2 : 2.4 + Math.random() * 0.8,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        width,
        height: slow ? width * (0.6 + Math.random()) : width * (0.3 + Math.random()),
        rotation: (Math.random() * 720 - 360).toFixed(0),
        drift: (Math.random() - 0.5) * 40,
        blur: slow && Math.random() > 0.6 ? 1 : 0,
      };
    };

    setPrimary(Array.from({ length: totalPrimary }, (_, index) => makePiece(index)));
    setSecondary(Array.from({ length: totalSecondary }, (_, index) => makePiece(index, true)));

    const timer = window.setTimeout(() => {
      setPrimary([]);
      setSecondary([]);
      if (onComplete) onComplete();
    }, 4200);

    return () => window.clearTimeout(timer);
  }, [show, onComplete, totalPrimary, totalSecondary]);

  if (primary.length === 0 && secondary.length === 0) return null;

  const renderPiece = (piece, slow) => (
    <span
      key={`${slow ? 's' : 'p'}-${piece.id}`}
      className="absolute"
      style={{
        left: `${piece.left}%`,
        top: '-5vh',
        width: `${piece.width}px`,
        height: `${piece.height}px`,
        borderRadius: piece.height > piece.width ? '6px' : '3px',
        background: `linear-gradient(140deg, ${piece.color} 0%, rgba(255,255,255,0.75) 100%)`,
        filter: piece.blur ? 'blur(1px)' : 'none',
        animation: `${slow ? 'confetti-fall-slow' : 'confetti-fall-fast'} ${piece.animationDuration}s ease-in forwards`,
        animationDelay: `${piece.animationDelay}s`,
        opacity: 0,
        '--confetti-rotation': `${piece.rotation}deg`,
        '--confetti-drift': `${piece.drift}vw`,
      }}
    />
  );

  return (
    <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden">
      <div className="absolute inset-0">
        {primary.map((piece) => renderPiece(piece, false))}
        {secondary.map((piece) => renderPiece(piece, true))}
      </div>

      <style>{`
        @keyframes confetti-fall-fast {
          0% {
            opacity: 0;
            transform: translate3d(0, -10vh, 0) rotate(0deg) scale(0.85);
          }
          10% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translate3d(var(--confetti-drift), 110vh, 0) rotate(var(--confetti-rotation)) scale(1);
          }
        }

        @keyframes confetti-fall-slow {
          0% {
            opacity: 0;
            transform: translate3d(0, -10vh, 0) rotate(0deg) scale(0.9);
          }
          12% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translate3d(calc(var(--confetti-drift) * 1.2), 115vh, 0) rotate(var(--confetti-rotation)) scale(1.05);
          }
        }
      `}</style>
    </div>
  );
}
import React, { useEffect, useState } from 'react';

export default function Confetti({ show, onComplete }) {
  const [confetti, setConfetti] = useState([]);

  useEffect(() => {
    if (!show) {
      setConfetti([]);
      return;
    }

    const pieces = [];
    for (let i = 0; i < 50; i++) {
      pieces.push({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.5,
        duration: 2 + Math.random() * 1,
        color: ['#FF6B4A', '#FFB399', '#FFC629', '#FF1B6D', '#00AFF0'][Math.floor(Math.random() * 5)]
      });
    }
    setConfetti(pieces);

    const timer = setTimeout(() => {
      setConfetti([]);
      if (onComplete) onComplete();
    }, 3000);

    return () => clearTimeout(timer);
  }, [show, onComplete]);

  if (confetti.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden">
      {confetti.map((piece) => (
        <div
          key={piece.id}
          className="absolute w-2 h-2 opacity-0"
          style={{
            left: `${piece.left}%`,
            top: '-10px',
            backgroundColor: piece.color,
            animation: `confettiFall ${piece.duration}s ease-in forwards`,
            animationDelay: `${piece.delay}s`,
            transform: 'rotate(45deg)'
          }}
        />
      ))}
      <style>{`
        @keyframes confettiFall {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
import React, { useEffect, useState } from 'react';

export default function Particles({ show, type = 'stars', onComplete }) {
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    if (!show) {
      setParticles([]);
      return;
    }

    const pieces = [];
    for (let i = 0; i < 30; i++) {
      pieces.push({
        id: i,
        left: 20 + Math.random() * 60,
        delay: Math.random() * 0.3,
        duration: 1.5 + Math.random() * 0.5,
        size: 8 + Math.random() * 8
      });
    }
    setParticles(pieces);

    const timer = setTimeout(() => {
      setParticles([]);
      if (onComplete) onComplete();
    }, 2500);

    return () => clearTimeout(timer);
  }, [show, onComplete]);

  if (particles.length === 0) return null;

  const emoji = type === 'stars' ? '⭐' : '✨';

  return (
    <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden">
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute opacity-0"
          style={{
            left: `${particle.left}%`,
            bottom: '-20px',
            fontSize: `${particle.size}px`,
            animation: `particleRise ${particle.duration}s ease-out forwards`,
            animationDelay: `${particle.delay}s`
          }}
        >
          {emoji}
        </div>
      ))}
      <style>{`
        @keyframes particleRise {
          0% {
            transform: translateY(0) scale(0);
            opacity: 1;
          }
          50% {
            transform: translateY(-50vh) scale(1);
            opacity: 1;
          }
          100% {
            transform: translateY(-100vh) scale(0.5);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
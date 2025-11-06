import React, { useEffect, useState } from 'react';
import { CheckCircle2, Zap, AlertCircle } from 'lucide-react';

export default function Toast({ show, message, type = 'success', onComplete }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (show) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        if (onComplete) onComplete();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [show, onComplete]);

  if (!visible) return null;

  const icons = {
    success: <CheckCircle2 className="w-6 h-6 text-green-500" />,
    credits: <Zap className="w-6 h-6 text-orange-500" />,
    alert: <AlertCircle className="w-6 h-6 text-red-500" />
  };

  const colors = {
    success: 'from-green-500 to-emerald-500',
    credits: 'from-orange-500 to-pink-500',
    alert: 'from-red-500 to-pink-500'
  };

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top-5 duration-300">
      <div className={`bg-gradient-to-r ${colors[type]} rounded-2xl shadow-2xl p-4 flex items-center gap-3 min-w-[300px] border-2 border-white/20`}>
        <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
          {icons[type]}
        </div>
        <div className="flex-1">
          <p className="text-white font-bold text-sm">{message}</p>
        </div>
      </div>
    </div>
  );
}
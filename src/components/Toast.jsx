// Componente de notificação Toast minimalista
import React from 'react';
import { CheckCircle } from 'lucide-react';

export function Toast({ message, type = 'info', onClose }) {
  return (
    <div className="fixed top-6 left-0 right-0 z-50 flex justify-center pointer-events-none">
      <div className="bg-white border-2 border-green-500 rounded-xl shadow-2xl p-5 flex items-center gap-3 min-w-[320px] max-w-md pointer-events-auto animate-fade-in">
        <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0" />
        <p className="flex-1 text-base text-gray-800 font-medium">{message}</p>
      </div>
    </div>
  );
}


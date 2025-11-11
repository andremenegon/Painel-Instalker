// Componente visual para mostrar se está usando Supabase ou Mock
import React from 'react';
import { isSupabaseConfigured } from '@/lib/supabaseClient';
import { Database, HardDrive } from 'lucide-react';

export default function SupabaseStatus() {
  const isConnected = isSupabaseConfigured();

  return (
    <div className={`fixed bottom-4 right-4 px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 text-sm font-medium ${
      isConnected 
        ? 'bg-green-500 text-white' 
        : 'bg-orange-500 text-white'
    }`}>
      {isConnected ? (
        <>
          <Database className="w-4 h-4" />
          <span>☁️ Supabase - Nuvem</span>
        </>
      ) : (
        <>
          <HardDrive className="w-4 h-4" />
          <span>💾 Local - Navegador</span>
        </>
      )}
    </div>
  );
}


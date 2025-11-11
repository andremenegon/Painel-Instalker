// Configuração do cliente Base44
// Usando Supabase REAL ou Mock baseado na configuração

import { isSupabaseConfigured } from '@/lib/supabaseClient';
import { supabaseAuth, supabaseEntities } from './supabaseAuth.js';
import { base44 as mockBase44 } from './base44ClientMock.js';

// Verificar se o Supabase está configurado
const useSupabase = isSupabaseConfigured();

let base44;

if (useSupabase) {
  console.log('🌐 Usando SUPABASE REAL - Dados salvos na nuvem!');
  base44 = {
    auth: supabaseAuth,
    entities: supabaseEntities
  };
} else {
  console.log('🔧 Usando Mock Local - Dados salvos no navegador');
  base44 = mockBase44;
}

export { base44 };

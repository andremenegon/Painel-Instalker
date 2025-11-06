// Por padrão, usa o mock local (não precisa de login)
// Para usar o Base44 real, crie um arquivo .env com: VITE_USE_MOCK=false
const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';

// Importar mock (sempre disponível)
import { base44 as mockBase44 } from './base44ClientMock.js';

// Por padrão usa mock, que funciona sem login
let base44 = mockBase44;

// Se não usar mock, carregar Base44 real de forma dinâmica
if (!USE_MOCK) {
  console.log('📡 Usando Base44 Real - Requer autenticação');
  import('@base44/sdk').then(({ createClient }) => {
    const appId = import.meta.env.VITE_BASE44_APP_ID || "69063d1664aa1fb78b1a2c02";
    base44 = createClient({
      appId: appId, 
      requiresAuth: true
    });
  });
} else {
  console.log('🔧 Usando Base44 Mock - Modo de desenvolvimento local (sem login necessário)');
}

export { base44 };

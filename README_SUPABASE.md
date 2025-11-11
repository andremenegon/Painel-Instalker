# 📚 Guia de Integração do Supabase

## ✅ O que já foi feito automaticamente:

1. ✅ Pacote `@supabase/supabase-js` instalado
2. ✅ Arquivo `src/lib/supabaseClient.js` criado com a configuração do cliente

## 🔧 O que você precisa fazer agora:

### Passo 1: Criar projeto no Supabase

1. Acesse https://app.supabase.com
2. Faça login ou crie uma conta
3. Clique em "New Project"
4. Preencha:
   - **Name**: Nome do seu projeto (ex: "Painel Instalker")
   - **Database Password**: Escolha uma senha forte (GUARDE ELA!)
   - **Region**: Escolha a região mais próxima (ex: South America)
5. Clique em "Create new project" e aguarde alguns minutos

### Passo 2: Obter as chaves da API

1. No painel do Supabase, vá em **Settings** (⚙️) no menu lateral
2. Clique em **API**
3. Você verá duas informações importantes:
   - **Project URL**: Algo como `https://xxxxx.supabase.co`
   - **anon public key**: Uma chave longa começando com `eyJ...`

### Passo 3: Criar arquivo .env na raiz do projeto

Na raiz do projeto (mesma pasta do `package.json`), crie um arquivo chamado `.env` com o seguinte conteúdo:

```env
# Configuração do Supabase
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon-aqui

# Configuração do Base44 (já existente)
VITE_USE_MOCK=false
VITE_BASE44_APP_ID=69063d1664aa1fb78b1a2c02
```

**⚠️ IMPORTANTE**: Substitua `https://seu-projeto.supabase.co` e `sua-chave-anon-aqui` pelas suas chaves reais do Passo 2!

### Passo 4: Reiniciar o servidor de desenvolvimento

Após criar o arquivo `.env`, você precisa reiniciar o servidor:

1. Pare o servidor atual (Ctrl+C no terminal)
2. Execute novamente: `npm run dev`

## 🎯 Como usar o Supabase no código

Agora você pode importar e usar o cliente Supabase em qualquer arquivo:

```javascript
import { supabase } from '@/lib/supabaseClient';

// Exemplo: Buscar dados de uma tabela
const { data, error } = await supabase
  .from('sua_tabela')
  .select('*');

// Exemplo: Inserir dados
const { data, error } = await supabase
  .from('sua_tabela')
  .insert([{ nome: 'João', email: 'joao@email.com' }]);
```

## 📊 Próximos passos (criar tabelas)

Depois de configurar, você precisará criar as tabelas no Supabase. Posso ajudar com isso também!

---

**Dúvidas?** Me avise que eu ajudo! 😊


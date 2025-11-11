# 🚀 Setup de Pagamentos PIX com Supabase + Mangofy

## ✅ PASSO 1: Criar Tabela no Supabase

1. Acesse o **SQL Editor** do Supabase: https://supabase.com/dashboard
2. Execute o arquivo `supabase_payment_tables.sql` (já criado no projeto)
3. Ou copie e execute este SQL:

```sql
-- Tabela de transações de pagamento
CREATE TABLE IF NOT EXISTS payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  charge_id TEXT NOT NULL UNIQUE,
  package_id INTEGER NOT NULL,
  credits INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  payment_method TEXT NOT NULL DEFAULT 'pix',
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_payment_transactions_user_email ON payment_transactions(user_email);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_charge_id ON payment_transactions(charge_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);

-- RLS
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own transactions"
  ON payment_transactions
  FOR SELECT
  USING (auth.jwt() ->> 'email' = user_email);

CREATE POLICY "System can insert transactions"
  ON payment_transactions
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update transactions"
  ON payment_transactions
  FOR UPDATE
  USING (true);
```

## ✅ PASSO 2: Atualizar .env

Adicione/atualize estas linhas no arquivo `.env`:

```bash
# Supabase (já deve ter)
VITE_SUPABASE_URL=sua_url_aqui
VITE_SUPABASE_ANON_KEY=sua_key_aqui

# Mangofy - Pagamentos PIX
VITE_MANGOFY_API_URL=https://api.mangofy.com.br/v1
VITE_MANGOFY_API_KEY=23380a9ecc86107db1b04569d12c0e2a127m7ldyeieuurdnavjdieilbasmzwb
VITE_MANGOFY_WEBHOOK_SECRET=seu_webhook_secret_aqui
```

## ✅ PASSO 3: Testar

1. Reinicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```

2. Acesse a página de compra de créditos

3. Clique em "Comprar Agora" em qualquer pacote

4. Deve abrir o modal com QR Code PIX

5. Faça um pagamento de teste

## 📋 O que foi alterado:

### Arquivos Criados:
- ✅ `/src/api/mangofyClient.js` - Cliente da API Mangofy
- ✅ `/src/components/payment/PixPaymentModal.jsx` - Modal com QR Code
- ✅ `supabase_payment_tables.sql` - SQL para criar tabelas
- ✅ `.env` - Variáveis de ambiente (já criado com sua API key)

### Arquivos Modificados:
- ✅ `/src/pages/BuyCredits.jsx` - Integrado com Supabase + Mangofy
  - Substituído `base44` por `supabase`
  - Adicionada criação de cobrança PIX
  - Adicionado polling para verificar pagamento
  - Adicionada atualização automática de créditos

## 🔄 Fluxo de Pagamento:

1. **Usuário clica "Comprar Agora"**
   → Sistema cria cobrança PIX via Mangofy
   → Salva transação como "pending" no Supabase

2. **Exibe Modal com QR Code**
   → QR Code para escaneamento
   → Código PIX copia-e-cola
   → Timer de 30 minutos

3. **Polling Automático** (a cada 3 segundos)
   → Verifica status na API Mangofy
   → Quando pago → Atualiza créditos automaticamente

4. **Pagamento Confirmado**
   → Adiciona créditos na tabela `user_profiles`
   → Atualiza transação para "completed"
   → Exibe mensagem de sucesso com som 🎵

## 🔧 Troubleshooting:

### Erro: "Cannot read property 'credits' of undefined"
**Solução:** Verifique se a tabela `user_profiles` tem a coluna `credits` (tipo INTEGER)

### QR Code não aparece
**Solução:** 
1. Abra o Console do navegador (F12)
2. Veja o erro retornado pela API Mangofy
3. Verifique se a API key está correta no `.env`

### Créditos não adicionados após pagamento
**Solução:**
1. Verifique no SQL Editor do Supabase se a transação foi criada:
   ```sql
   SELECT * FROM payment_transactions ORDER BY created_at DESC LIMIT 10;
   ```
2. Veja se o status foi atualizado para "completed"
3. Verifique se o polling está ativo (console do navegador)

### Erro: "relation payment_transactions does not exist"
**Solução:** Execute o SQL do PASSO 1 no Supabase

## 📊 Como Verificar Transações:

No SQL Editor do Supabase:

```sql
-- Ver todas as transações
SELECT 
  id,
  user_email,
  charge_id,
  credits,
  amount / 100.0 as valor_reais,
  status,
  created_at,
  paid_at
FROM payment_transactions
ORDER BY created_at DESC;

-- Ver transações pendentes
SELECT * FROM payment_transactions WHERE status = 'pending';

-- Ver transações completas
SELECT * FROM payment_transactions WHERE status = 'completed';
```

## 🎯 Próximos Passos Opcionais:

### 1. Webhook da Mangofy (Recomendado)

Para receber notificações instantâneas de pagamento, configure um webhook.

Você precisaria de um endpoint no backend:
```
POST https://seu-backend.com/api/webhooks/mangofy
```

Exemplo básico (Node.js/Express):
```javascript
app.post('/api/webhooks/mangofy', async (req, res) => {
  const { event, data } = req.body;
  
  if (event === 'charge.paid') {
    // Buscar transação no Supabase
    const { data: transaction } = await supabase
      .from('payment_transactions')
      .select('*')
      .eq('charge_id', data.id)
      .single();
    
    if (transaction && transaction.status === 'pending') {
      // Atualizar créditos
      await supabase
        .from('user_profiles')
        .update({ 
          credits: supabase.rpc('increment_credits', { 
            email: transaction.user_email, 
            amount: transaction.credits 
          })
        });
      
      // Marcar como pago
      await supabase
        .from('payment_transactions')
        .update({ 
          status: 'completed',
          paid_at: new Date().toISOString()
        })
        .eq('charge_id', data.id);
    }
  }
  
  res.status(200).json({ received: true });
});
```

### 2. Histórico de Compras

Criar uma página para o usuário ver suas compras anteriores.

### 3. Notificações

Enviar email quando o pagamento for confirmado.

## 🆘 Suporte:

Se tiver qualquer erro, me mande:
1. Print do erro no console (F12)
2. Resposta da API no Network tab
3. Status da transação no Supabase

---

✅ **Tudo pronto! Agora é só executar o PASSO 1 e PASSO 2 que o sistema de pagamentos vai funcionar!**


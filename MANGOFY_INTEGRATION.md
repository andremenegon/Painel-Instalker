# Integração Mangofy - Pagamentos PIX

## 📋 Configuração

### 1. Variáveis de Ambiente

Adicione as seguintes variáveis no seu arquivo `.env`:

```bash
VITE_MANGOFY_API_URL=https://api.mangofy.com.br/v1
VITE_MANGOFY_API_KEY=sua_api_key_aqui
VITE_MANGOFY_WEBHOOK_SECRET=seu_webhook_secret_aqui
```

### 2. Entidade PaymentTransaction no Base44

Crie a entidade `PaymentTransaction` no Base44 com os seguintes campos:

- `user_email` (string) - Email do usuário
- `charge_id` (string) - ID da cobrança na Mangofy
- `package_id` (number) - ID do pacote comprado
- `credits` (number) - Quantidade de créditos
- `amount` (number) - Valor em centavos
- `status` (string) - Status: pending, completed, failed, expired
- `payment_method` (string) - Método: pix
- `paid_at` (string) - Data/hora do pagamento (ISO)
- `created_at` (string) - Data/hora de criação (ISO)

## 🔄 Fluxo de Pagamento

### 1. Frontend (BuyCredits.jsx)

1. Usuário clica em "Comprar Agora"
2. Sistema cria cobrança via API da Mangofy
3. Salva transação como "pending" no banco
4. Exibe modal com QR Code PIX
5. Inicia polling (verificação a cada 3s)

### 2. Verificação de Pagamento

O sistema faz polling na API da Mangofy para verificar o status:

- **paid** → Adiciona créditos e marca como "completed"
- **expired/cancelled** → Fecha modal e notifica usuário

### 3. Webhook (Opcional mas Recomendado)

Para receber notificações instantâneas, configure o webhook da Mangofy.

#### Endpoint de Webhook

Crie um endpoint no seu backend em:

```
POST /api/webhooks/mangofy
```

#### Exemplo de Implementação (Node.js)

```javascript
app.post('/api/webhooks/mangofy', async (req, res) => {
  const signature = req.headers['x-mangofy-signature'];
  const payload = JSON.stringify(req.body);
  
  // Verificar assinatura
  const isValid = mangofyClient.verifyWebhookSignature(signature, payload);
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  const { event, data } = req.body;
  
  if (event === 'charge.paid') {
    // Buscar transação
    const transaction = await base44.entities.PaymentTransaction
      .filter({ charge_id: data.id })
      .first();
    
    if (transaction && transaction.status === 'pending') {
      // Buscar usuário
      const userProfile = await base44.entities.UserProfile
        .filter({ created_by: transaction.user_email })
        .first();
      
      // Adicionar créditos
      await base44.entities.UserProfile.update(userProfile.id, {
        credits: userProfile.credits + transaction.credits
      });
      
      // Atualizar transação
      await base44.entities.PaymentTransaction.update(transaction.id, {
        status: 'completed',
        paid_at: new Date().toISOString()
      });
    }
  }
  
  res.status(200).json({ received: true });
});
```

#### Configurar Webhook na Mangofy

1. Acesse o painel da Mangofy
2. Vá em **Configurações → Webhooks**
3. Adicione a URL: `https://seu-backend.com/api/webhooks/mangofy`
4. Selecione os eventos: `charge.paid`, `charge.expired`, `charge.cancelled`
5. Copie o **Webhook Secret** e adicione no `.env`

## 🛠️ Arquivos Criados

### 1. `/src/api/mangofyClient.js`
Cliente para integração com a API da Mangofy.

**Métodos:**
- `createPixCharge(data)` - Cria uma cobrança PIX
- `getCharge(chargeId)` - Consulta status de uma cobrança
- `listCharges(customerId)` - Lista cobranças de um cliente
- `cancelCharge(chargeId)` - Cancela uma cobrança
- `verifyWebhookSignature(signature, payload)` - Verifica assinatura do webhook
- `processWebhook(payload)` - Processa payload do webhook

### 2. `/src/components/payment/PixPaymentModal.jsx`
Modal que exibe o QR Code e código PIX copia-e-cola.

**Funcionalidades:**
- Exibe QR Code para escaneamento
- Código PIX copia-e-cola
- Timer de expiração (30 minutos)
- Status de verificação em tempo real

### 3. `/src/pages/BuyCredits.jsx` (Modificado)
Página de compra integrada com PIX.

**Mudanças:**
- Importa `mangofyClient` e `PixPaymentModal`
- Cria cobrança PIX em vez de adicionar créditos diretamente
- Polling para verificar pagamento a cada 3 segundos
- Adiciona créditos automaticamente quando pagamento confirmado

## 📊 Dados do QR Code

A resposta da Mangofy deve conter:

```json
{
  "id": "charge_12345",
  "status": "pending",
  "amount": 2990,
  "pix": {
    "qrcode": "00020126580014br.gov.bcb.pix...",
    "qrcode_url": "https://api.mangofy.com.br/qrcodes/charge_12345.png"
  },
  "expires_at": "2025-11-11T15:30:00Z",
  "customer": {
    "id": "user@email.com",
    "email": "user@email.com",
    "name": "Nome do Usuário"
  },
  "metadata": {
    "package_id": 2,
    "credits": 350,
    "bonus": 50
  }
}
```

## 🔒 Segurança

1. **API Key**: Nunca exponha a API key no código frontend
2. **Webhook Secret**: Use para verificar a autenticidade dos webhooks
3. **HTTPS**: Sempre use HTTPS em produção
4. **Validação**: Valide todos os dados recebidos
5. **Idempotência**: Evite duplicação de créditos verificando se a transação já foi processada

## 🧪 Testes

### Ambiente de Sandbox

A Mangofy deve fornecer um ambiente de testes. Configure:

```bash
VITE_MANGOFY_API_URL=https://sandbox.api.mangofy.com.br/v1
VITE_MANGOFY_API_KEY=test_key_aqui
```

### Simular Pagamento

No ambiente de sandbox, você pode simular pagamentos diretamente pela API ou painel.

## 📱 Fluxo Completo

```
1. Usuário escolhe pacote → handleBuy()
2. Frontend cria cobrança → mangofyClient.createPixCharge()
3. Salva transação "pending" → base44.entities.PaymentTransaction.create()
4. Exibe modal PIX → setShowPixModal(true)
5. Inicia polling → useEffect com setInterval
6. Usuário paga via app do banco
7. Mangofy confirma pagamento → webhook (opcional) + polling
8. Frontend detecta pagamento → charge.status === 'paid'
9. Adiciona créditos → UserProfile.update()
10. Atualiza transação → PaymentTransaction.update()
11. Exibe confirmação → setShowSuccessModal(true)
```

## 🎯 Próximos Passos

1. ✅ Obter credenciais da Mangofy
2. ✅ Adicionar variáveis no `.env`
3. ✅ Criar entidade `PaymentTransaction` no Base44
4. ✅ Testar em ambiente de sandbox
5. ⚠️ Implementar webhook no backend (recomendado)
6. ✅ Configurar webhook na Mangofy
7. ✅ Testar pagamento real
8. ✅ Monitorar transações

## 🐛 Troubleshooting

### Erro: "API Key inválida"
- Verifique se copiou a chave corretamente
- Confirme se está usando o ambiente correto (sandbox vs produção)

### QR Code não aparece
- Verifique a resposta da API no console
- Confirme que `charge.pix.qrcode_url` existe

### Créditos não adicionados
- Verifique logs do webhook
- Confirme que o polling está ativo
- Verifique se a transação foi salva no banco

### Pagamento duplicado
- Implemente verificação de `charge_id` único
- Use o campo `status` da transação


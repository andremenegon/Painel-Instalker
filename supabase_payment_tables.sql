-- ================================================
-- TABELA: payment_transactions
-- Armazena todas as transações de pagamento PIX
-- ================================================

CREATE TABLE IF NOT EXISTS payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  charge_id TEXT NOT NULL UNIQUE,
  package_id INTEGER NOT NULL,
  credits INTEGER NOT NULL,
  amount INTEGER NOT NULL, -- Valor em centavos
  status TEXT NOT NULL DEFAULT 'pending', -- pending, completed, failed, expired
  payment_method TEXT NOT NULL DEFAULT 'pix',
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_payment_transactions_user_email ON payment_transactions(user_email);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_charge_id ON payment_transactions(charge_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_created_at ON payment_transactions(created_at DESC);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_payment_transactions_updated_at
  BEFORE UPDATE ON payment_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ================================================
-- RLS (Row Level Security) - Segurança
-- ================================================

-- Habilitar RLS
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;

-- Política: Usuários podem ver apenas suas próprias transações
CREATE POLICY "Users can view their own transactions"
  ON payment_transactions
  FOR SELECT
  USING (auth.jwt() ->> 'email' = user_email);

-- Política: Sistema pode inserir transações
CREATE POLICY "System can insert transactions"
  ON payment_transactions
  FOR INSERT
  WITH CHECK (true);

-- Política: Sistema pode atualizar transações
CREATE POLICY "System can update transactions"
  ON payment_transactions
  FOR UPDATE
  USING (true);

-- ================================================
-- COMENTÁRIOS
-- ================================================

COMMENT ON TABLE payment_transactions IS 'Armazena todas as transações de pagamento PIX via Mangofy';
COMMENT ON COLUMN payment_transactions.charge_id IS 'ID único da cobrança na Mangofy';
COMMENT ON COLUMN payment_transactions.amount IS 'Valor em centavos (ex: 2990 = R$ 29,90)';
COMMENT ON COLUMN payment_transactions.status IS 'Status: pending, completed, failed, expired';


-- ============================================
-- SCHEMA DO BANCO DE DADOS - PAINEL INSTALKER
-- POSTGRESQL VERSION
-- Execute este SQL no pgAdmin ou psql
-- ============================================

-- Criar banco de dados (execute separadamente se necessário)
-- CREATE DATABASE instalker;

-- ============================================
-- 1. TABELA: users
-- Armazena os usuários do sistema
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  role VARCHAR(50) DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ============================================
-- 2. TABELA: user_profiles
-- Armazena os perfis dos usuários (créditos, nível, XP)
-- ============================================
CREATE TABLE IF NOT EXISTS user_profiles (
  id SERIAL PRIMARY KEY,
  created_by VARCHAR(255) NOT NULL UNIQUE,
  credits INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  xp INTEGER NOT NULL DEFAULT 0,
  total_investigations INTEGER NOT NULL DEFAULT 0,
  investigation_history JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT fk_user_profiles_email FOREIGN KEY (created_by) REFERENCES users(email) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_created_by ON user_profiles(created_by);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 3. TABELA: investigations
-- Armazena todas as investigações realizadas
-- ============================================
CREATE TABLE IF NOT EXISTS investigations (
  id SERIAL PRIMARY KEY,
  service_name VARCHAR(255) NOT NULL,
  target_username VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'processing',
  progress INTEGER NOT NULL DEFAULT 1 CHECK (progress >= 0 AND progress <= 100),
  estimated_days INTEGER NOT NULL DEFAULT 0,
  is_accelerated BOOLEAN NOT NULL DEFAULT false,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT fk_investigations_email FOREIGN KEY (created_by) REFERENCES users(email) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_investigations_created_by ON investigations(created_by);
CREATE INDEX IF NOT EXISTS idx_investigations_status ON investigations(status);
CREATE INDEX IF NOT EXISTS idx_investigations_service_name ON investigations(service_name);
CREATE INDEX IF NOT EXISTS idx_investigations_created_at ON investigations(created_at DESC);

-- Trigger para atualizar updated_at automaticamente
CREATE TRIGGER update_investigations_updated_at
  BEFORE UPDATE ON investigations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 4. TABELA: services
-- Armazena os serviços disponíveis no sistema
-- ============================================
CREATE TABLE IF NOT EXISTS services (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  credits_cost INTEGER NOT NULL DEFAULT 0,
  xp_reward INTEGER NOT NULL DEFAULT 0,
  min_progress DECIMAL(5,4) DEFAULT 0.003,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_services_name ON services(name);

-- Trigger para atualizar updated_at automaticamente
CREATE TRIGGER update_services_updated_at
  BEFORE UPDATE ON services
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Inserir serviços padrão
INSERT INTO services (name, description, credits_cost, xp_reward, min_progress) VALUES
  ('WhatsApp', 'Monitoramento de conversas do WhatsApp', 30, 15, 0.003),
  ('Instagram', 'Análise de perfil e posts do Instagram', 25, 12, 0.003),
  ('Facebook', 'Monitoramento de atividades do Facebook', 25, 12, 0.003),
  ('SMS', 'Leitura de mensagens SMS', 30, 15, 0.003),
  ('Chamadas', 'Histórico de chamadas telefônicas', 25, 12, 0.003),
  ('Localização', 'Rastreamento GPS em tempo real', 40, 20, 0.003),
  ('Câmera', 'Acesso remoto à câmera do dispositivo', 55, 25, 0.003),
  ('Detetive Particular', 'Investigação completa personalizada', 100, 50, 0.003),
  ('Outras Redes', 'Monitoramento de outras redes sociais', 20, 10, 0.003)
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- FIM DO SCRIPT
-- ============================================


-- ============================================
-- SCHEMA DO BANCO DE DADOS - PAINEL INSTALKER
-- MYSQL VERSION
-- Execute este SQL no phpMyAdmin ou MySQL Workbench
-- ============================================

-- Criar banco de dados (se não existir)
CREATE DATABASE IF NOT EXISTS instalker CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE instalker;

-- ============================================
-- 1. TABELA: users
-- Armazena os usuários do sistema
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  role VARCHAR(50) DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 2. TABELA: user_profiles
-- Armazena os perfis dos usuários (créditos, nível, XP)
-- ============================================
CREATE TABLE IF NOT EXISTS user_profiles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  created_by VARCHAR(255) NOT NULL UNIQUE,
  credits INT NOT NULL DEFAULT 0,
  level INT NOT NULL DEFAULT 1,
  xp INT NOT NULL DEFAULT 0,
  total_investigations INT NOT NULL DEFAULT 0,
  investigation_history JSON DEFAULT '[]',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_created_by (created_by),
  FOREIGN KEY (created_by) REFERENCES users(email) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 3. TABELA: investigations
-- Armazena todas as investigações realizadas
-- ============================================
CREATE TABLE IF NOT EXISTS investigations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  service_name VARCHAR(255) NOT NULL,
  target_username VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'processing',
  progress INT NOT NULL DEFAULT 1 CHECK (progress >= 0 AND progress <= 100),
  estimated_days INT NOT NULL DEFAULT 0,
  is_accelerated BOOLEAN NOT NULL DEFAULT false,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_created_by (created_by),
  INDEX idx_status (status),
  INDEX idx_service_name (service_name),
  INDEX idx_created_at (created_at DESC),
  FOREIGN KEY (created_by) REFERENCES users(email) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 4. TABELA: services
-- Armazena os serviços disponíveis no sistema
-- ============================================
CREATE TABLE IF NOT EXISTS services (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  credits_cost INT NOT NULL DEFAULT 0,
  xp_reward INT NOT NULL DEFAULT 0,
  min_progress DECIMAL(5,4) DEFAULT 0.003,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
ON DUPLICATE KEY UPDATE name=name;

-- ============================================
-- FIM DO SCRIPT
-- ============================================


import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query, queryOne } from '../config/database.js';

const router = express.Router();

// Registrar novo usuário
router.post('/register', async (req, res) => {
  try {
    const { email, password, full_name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    // Verificar se usuário já existe
    const dbType = process.env.DB_TYPE || 'mysql';
    const existingUser = await queryOne(
      dbType === 'postgresql' || dbType === 'postgres'
        ? 'SELECT id FROM users WHERE email = $1'
        : 'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existingUser) {
      return res.status(400).json({ error: 'Email já cadastrado' });
    }

    // Hash da senha
    const hashedPassword = await bcrypt.hash(password, 10);

    // Criar usuário
    let userId;

    if (dbType === 'postgresql' || dbType === 'postgres') {
      const result = await query(
        `INSERT INTO users (email, password, full_name, created_at) 
         VALUES ($1, $2, $3, NOW()) RETURNING id`,
        [email, hashedPassword, full_name || null]
      );
      userId = result[0].id;
    } else {
      const result = await query(
        `INSERT INTO users (email, password, full_name, created_at) 
         VALUES (?, ?, ?, NOW())`,
        [email, hashedPassword, full_name || null]
      );
      userId = result.insertId;
    }

    // Criar token JWT
    const token = jwt.sign(
      { id: userId, email },
      process.env.JWT_SECRET || 'seu-secret-super-seguro-mude-isso',
      { expiresIn: '7d' }
    );

    res.json({
      user: {
        id: userId,
        email,
        full_name: full_name || null,
        created_at: new Date().toISOString()
      },
      token
    });
  } catch (error) {
    console.error('Erro ao registrar:', error);
    res.status(500).json({ 
      error: 'Erro ao criar conta', 
      details: error.message,
      code: error.code 
    });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    // Buscar usuário
    const dbType = process.env.DB_TYPE || 'mysql';
    const user = await queryOne(
      dbType === 'postgresql' || dbType === 'postgres'
        ? 'SELECT id, email, password, full_name, role FROM users WHERE email = $1'
        : 'SELECT id, email, password, full_name, role FROM users WHERE email = ?',
      [email]
    );

    if (!user) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    // Verificar senha
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    // Criar token JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'seu-secret-super-seguro-mude-isso',
      { expiresIn: '7d' }
    );

    res.json({
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role || 'user',
        created_at: user.created_at
      },
      token
    });
  } catch (error) {
    console.error('Erro ao fazer login:', error);
    res.status(500).json({ error: 'Erro ao fazer login' });
  }
});

// Obter usuário atual (requer autenticação)
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Token não fornecido' });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'seu-secret-super-seguro-mude-isso'
    );

    const dbType = process.env.DB_TYPE || 'mysql';
    const user = await queryOne(
      dbType === 'postgresql' || dbType === 'postgres'
        ? 'SELECT id, email, full_name, role, created_at FROM users WHERE id = $1'
        : 'SELECT id, email, full_name, role, created_at FROM users WHERE id = ?',
      [decoded.id]
    );

    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    res.json({
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role || 'user',
      created_at: user.created_at
    });
  } catch (error) {
    console.error('Erro ao buscar usuário:', error);
    res.status(401).json({ error: 'Token inválido' });
  }
});

export default router;


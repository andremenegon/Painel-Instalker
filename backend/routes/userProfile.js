import express from 'express';
import { query, queryOne } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Todas as rotas requerem autenticação
router.use(authenticateToken);

// Listar perfis do usuário atual
router.get('/', async (req, res) => {
  try {
    const email = req.user.email;
    const dbType = process.env.DB_TYPE || 'mysql';
    const profiles = await query(
      dbType === 'postgresql' || dbType === 'postgres'
        ? 'SELECT * FROM user_profiles WHERE created_by = $1'
        : 'SELECT * FROM user_profiles WHERE created_by = ?',
      [email]
    );
    res.json(profiles);
  } catch (error) {
    console.error('Erro ao buscar perfis:', error);
    res.status(500).json({ error: 'Erro ao buscar perfis' });
  }
});

// Criar ou atualizar perfil
router.post('/', async (req, res) => {
  try {
    const email = req.user.email;
    const { credits, level, xp, total_investigations, investigation_history } = req.body;

    // Verificar se já existe
    const dbType = process.env.DB_TYPE || 'mysql';
    const existing = await queryOne(
      dbType === 'postgresql' || dbType === 'postgres'
        ? 'SELECT id FROM user_profiles WHERE created_by = $1'
        : 'SELECT id FROM user_profiles WHERE created_by = ?',
      [email]
    );

    if (existing) {
      // Atualizar
      const updateSql = dbType === 'postgresql' || dbType === 'postgres'
        ? `UPDATE user_profiles 
           SET credits = $1, level = $2, xp = $3, total_investigations = $4, 
               investigation_history = $5, updated_at = NOW()
           WHERE created_by = $6`
        : `UPDATE user_profiles 
           SET credits = ?, level = ?, xp = ?, total_investigations = ?, 
               investigation_history = ?, updated_at = NOW()
           WHERE created_by = ?`;
      
      await query(updateSql, [
        credits || 0,
        level || 1,
        xp || 0,
        total_investigations || 0,
        investigation_history ? JSON.stringify(investigation_history) : '[]',
        email
      ]);
      
      const updated = await queryOne(
        dbType === 'postgresql' || dbType === 'postgres'
          ? 'SELECT * FROM user_profiles WHERE created_by = $1'
          : 'SELECT * FROM user_profiles WHERE created_by = ?',
        [email]
      );
      res.json(updated);
    } else {
      // Criar novo
      let newProfile;
      if (dbType === 'postgresql' || dbType === 'postgres') {
        const result = await query(
          `INSERT INTO user_profiles (created_by, credits, level, xp, total_investigations, investigation_history, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW()) RETURNING *`,
          [
            email,
            credits || 0,
            level || 1,
            xp || 0,
            total_investigations || 0,
            investigation_history ? JSON.stringify(investigation_history) : '[]'
          ]
        );
        newProfile = result[0];
      } else {
        await query(
          `INSERT INTO user_profiles (created_by, credits, level, xp, total_investigations, investigation_history, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [
            email,
            credits || 0,
            level || 1,
            xp || 0,
            total_investigations || 0,
            investigation_history ? JSON.stringify(investigation_history) : '[]'
          ]
        );
        newProfile = await queryOne(
          dbType === 'postgresql' || dbType === 'postgres'
            ? 'SELECT * FROM user_profiles WHERE created_by = $1 ORDER BY created_at DESC LIMIT 1'
            : 'SELECT * FROM user_profiles WHERE created_by = ? ORDER BY created_at DESC LIMIT 1',
          [email]
        );
      }
      res.json(newProfile);
    }
  } catch (error) {
    console.error('Erro ao criar/atualizar perfil:', error);
    res.status(500).json({ error: 'Erro ao salvar perfil' });
  }
});

// Atualizar perfil
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const email = req.user.email;
    const { credits, level, xp, total_investigations, investigation_history } = req.body;

    // Verificar se o perfil pertence ao usuário
    const dbType = process.env.DB_TYPE || 'mysql';
    const profile = await queryOne(
      dbType === 'postgresql' || dbType === 'postgres'
        ? 'SELECT id FROM user_profiles WHERE id = $1 AND created_by = $2'
        : 'SELECT id FROM user_profiles WHERE id = ? AND created_by = ?',
      [id, email]
    );

    if (!profile) {
      return res.status(404).json({ error: 'Perfil não encontrado' });
    }

    await query(
      `UPDATE user_profiles 
       SET credits = ?, level = ?, xp = ?, total_investigations = ?, 
           investigation_history = ?, updated_at = NOW()
       WHERE id = ? AND created_by = ?`,
      [
        credits,
        level,
        xp,
        total_investigations,
        investigation_history ? JSON.stringify(investigation_history) : '[]',
        id,
        email
      ]
    );

    const updated = await queryOne(
      dbType === 'postgresql' || dbType === 'postgres'
        ? 'SELECT * FROM user_profiles WHERE id = $1'
        : 'SELECT * FROM user_profiles WHERE id = ?',
      [id]
    );

    res.json(updated);
  } catch (error) {
    console.error('Erro ao atualizar perfil:', error);
    res.status(500).json({ error: 'Erro ao atualizar perfil' });
  }
});

export default router;


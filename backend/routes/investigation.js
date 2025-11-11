import express from 'express';
import { query, queryOne } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Todas as rotas requerem autenticação
router.use(authenticateToken);

// Listar investigações do usuário
router.get('/', async (req, res) => {
  try {
    const email = req.user.email;
    const dbType = process.env.DB_TYPE || 'mysql';
    const investigations = await query(
      dbType === 'postgresql' || dbType === 'postgres'
        ? 'SELECT * FROM investigations WHERE created_by = $1 ORDER BY created_at DESC'
        : 'SELECT * FROM investigations WHERE created_by = ? ORDER BY created_at DESC',
      [email]
    );
    
    // Converter JSON strings para objetos
    const formatted = investigations.map(inv => ({
      ...inv,
      investigation_history: typeof inv.investigation_history === 'string' 
        ? JSON.parse(inv.investigation_history || '[]')
        : inv.investigation_history
    }));
    
    res.json(formatted);
  } catch (error) {
    console.error('Erro ao buscar investigações:', error);
    res.status(500).json({ error: 'Erro ao buscar investigações' });
  }
});

// Criar nova investigação
router.post('/', async (req, res) => {
  try {
    const email = req.user.email;
    const {
      service_name,
      target_username,
      status = 'processing',
      progress = 1,
      estimated_days = 0,
      is_accelerated = false
    } = req.body;

    if (!service_name || !target_username) {
      return res.status(400).json({ error: 'service_name e target_username são obrigatórios' });
    }

    const dbType = process.env.DB_TYPE || 'mysql';
    let newInvestigation;

    if (dbType === 'postgresql' || dbType === 'postgres') {
      const result = await query(
        `INSERT INTO investigations (service_name, target_username, status, progress, estimated_days, is_accelerated, created_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW()) RETURNING *`,
        [service_name, target_username, status, progress, estimated_days, is_accelerated, email]
      );
      newInvestigation = result[0];
    } else {
      await query(
        `INSERT INTO investigations (service_name, target_username, status, progress, estimated_days, is_accelerated, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [service_name, target_username, status, progress, estimated_days, is_accelerated, email]
      );
      const result = await query(
        dbType === 'postgresql' || dbType === 'postgres'
          ? 'SELECT * FROM investigations WHERE created_by = $1 ORDER BY created_at DESC LIMIT 1'
          : 'SELECT * FROM investigations WHERE created_by = ? ORDER BY created_at DESC LIMIT 1',
        [email]
      );
      newInvestigation = result[0];
    }

    res.status(201).json(newInvestigation);
  } catch (error) {
    console.error('Erro ao criar investigação:', error);
    res.status(500).json({ error: 'Erro ao criar investigação' });
  }
});

// Atualizar investigação
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const email = req.user.email;
    const { status, progress, estimated_days, is_accelerated } = req.body;
    const dbType = process.env.DB_TYPE || 'mysql';

    // Verificar se a investigação pertence ao usuário
    const investigation = await queryOne(
      dbType === 'postgresql' || dbType === 'postgres'
        ? 'SELECT id FROM investigations WHERE id = $1 AND created_by = $2'
        : 'SELECT id FROM investigations WHERE id = ? AND created_by = ?',
      [id, email]
    );

    if (!investigation) {
      return res.status(404).json({ error: 'Investigação não encontrada' });
    }

    const updateSql = dbType === 'postgresql' || dbType === 'postgres'
      ? `UPDATE investigations 
         SET status = $1, progress = $2, estimated_days = $3, is_accelerated = $4, updated_at = NOW()
         WHERE id = $5 AND created_by = $6`
      : `UPDATE investigations 
         SET status = ?, progress = ?, estimated_days = ?, is_accelerated = ?, updated_at = NOW()
         WHERE id = ? AND created_by = ?`;
    
    await query(updateSql, [status, progress, estimated_days, is_accelerated, id, email]);

    const updated = await queryOne(
      dbType === 'postgresql' || dbType === 'postgres'
        ? 'SELECT * FROM investigations WHERE id = $1'
        : 'SELECT * FROM investigations WHERE id = ?',
      [id]
    );

    res.json(updated);
  } catch (error) {
    console.error('Erro ao atualizar investigação:', error);
    res.status(500).json({ error: 'Erro ao atualizar investigação' });
  }
});

// Deletar investigação
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const email = req.user.email;
    const dbType = process.env.DB_TYPE || 'mysql';
    
    // Verificar se a investigação pertence ao usuário
    const investigation = await queryOne(
      dbType === 'postgresql' || dbType === 'postgres'
        ? 'SELECT id FROM investigations WHERE id = $1 AND created_by = $2'
        : 'SELECT id FROM investigations WHERE id = ? AND created_by = ?',
      [id, email]
    );

    if (!investigation) {
      return res.status(404).json({ error: 'Investigação não encontrada' });
    }

    await query(
      dbType === 'postgresql' || dbType === 'postgres'
        ? 'DELETE FROM investigations WHERE id = $1 AND created_by = $2'
        : 'DELETE FROM investigations WHERE id = ? AND created_by = ?',
      [id, email]
    );

    res.json({ message: 'Investigação deletada com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar investigação:', error);
    res.status(500).json({ error: 'Erro ao deletar investigação' });
  }
});

export default router;


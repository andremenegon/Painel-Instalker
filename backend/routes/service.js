import express from 'express';
import { query } from '../config/database.js';

const router = express.Router();

// Listar todos os serviços (público)
router.get('/', async (req, res) => {
  try {
    const services = await query(
      'SELECT * FROM services ORDER BY name ASC'
    );
    res.json(services);
  } catch (error) {
    console.error('Erro ao buscar serviços:', error);
    res.status(500).json({ error: 'Erro ao buscar serviços' });
  }
});

export default router;


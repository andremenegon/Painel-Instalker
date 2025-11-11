import mysql from 'mysql2/promise';
import pkg from 'pg';
const { Pool } = pkg;

let pool = null;

// Configurar conexão com banco de dados
export const getDatabase = () => {
  if (pool) return pool;

  const dbType = process.env.DB_TYPE || 'mysql';
  
  if (dbType === 'postgresql' || dbType === 'postgres') {
    // PostgreSQL
    pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'instalker',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
    });
  } else {
    // MySQL
    pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      database: process.env.DB_NAME || 'instalker',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
  }

  return pool;
};

// Helper para executar queries
export const query = async (sql, params = []) => {
  const db = getDatabase();
  const dbType = process.env.DB_TYPE || 'mysql';

  try {
    if (dbType === 'postgresql' || dbType === 'postgres') {
      const result = await db.query(sql, params);
      return result.rows;
    } else {
      const [rows] = await db.execute(sql, params);
      return rows;
    }
  } catch (error) {
    console.error('Erro na query:', error);
    throw error;
  }
};

// Helper para executar INSERT e retornar o resultado completo
export const insert = async (sql, params = []) => {
  const db = getDatabase();
  const dbType = process.env.DB_TYPE || 'mysql';

  try {
    if (dbType === 'postgresql' || dbType === 'postgres') {
      const result = await db.query(sql, params);
      return { rows: result.rows, insertId: result.rows[0]?.id };
    } else {
      const [result] = await db.execute(sql, params);
      return { rows: [], insertId: result.insertId };
    }
  } catch (error) {
    console.error('Erro no INSERT:', error);
    throw error;
  }
};

// Helper para executar queries que retornam apenas um resultado
export const queryOne = async (sql, params = []) => {
  const results = await query(sql, params);
  return results[0] || null;
};


// db/connection.js
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

async function runSQL(sqlQuery) {
  try {
    const result = await pool.query(sqlQuery);
    return result.rows;
  } catch (error) {
    console.error('❌ SQL execution error:', error.message);
    throw error;
  }
}

module.exports = { pool, runSQL };

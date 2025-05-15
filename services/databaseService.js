const { Client } = require('pg');
require('dotenv').config();

// Setup PostgreSQL Client
const pgClient = new Client({
  connectionString: process.env.POSTGRES_URL
});

pgClient.connect()
  .then(() => console.log('✅ Connected to PostgreSQL'))
  .catch(err => console.error('❌ PostgreSQL connection error:', err.message));

async function runSQL(sqlQuery) {

  try {
    const res = await pgClient.query(sqlQuery);

    return res.rows;
  } catch (error) {
    console.error('❌ SQL execution error:', error.message);
    throw error;
  }
}

module.exports = { pgClient, runSQL };

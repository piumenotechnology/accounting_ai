const { Pool } = require('pg');
require('dotenv').config();

// const pool = new Pool({
//   host: process.env.PG_HOST,
//   port: process.env.PG_PORT,
//   user: process.env.PG_USER,
//   password: process.env.PG_PASSWORD,
//   database: process.env.PG_DATABASE,
// });

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

module.exports = pool;

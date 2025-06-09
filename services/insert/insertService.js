const { pgClient } = require('../databaseService');

async function insertMappedData(mappedData) {
  for (const [tableName, rows] of Object.entries(mappedData)) {
    if (rows.length === 0) continue;

    console.log(`⚡ Inserting into ${tableName}: ${rows.length} rows`);

    //Delete old data first
    await pgClient.query(`DELETE FROM ${tableName}`);

    const columns = Object.keys(rows[0]);

    await pgClient.query('BEGIN');

    try {
      for (const row of rows) {
        const values = columns.map(col => row[col]);

        const placeholders = columns.map((_, idx) => `$${idx + 1}`).join(', ');
        
        const insertQuery = `
          INSERT INTO ${tableName} (${columns.join(', ')})
          VALUES (${placeholders})
        `;
        await pgClient.query(insertQuery, values);
      }

      await pgClient.query('COMMIT');
      console.log(`✅ Inserted ${rows.length} rows into ${tableName}`);
    } catch (error) {
      await pgClient.query('ROLLBACK');
      console.error(`❌ Failed inserting rows into ${tableName}:`, error.message);
      throw error;
    }
  }
}



module.exports = { insertMappedData };

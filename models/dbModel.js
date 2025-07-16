const { pool } = require('../config/db');

const databaseModel = {
    createDatabase: async (dbName) => {
        console.log(`Creating database with name: ${dbName}`);
        const query = `CREATE DATABASE ${dbName}`;
        try {
            await pool.query(query);
            console.log(`✅ Database ${dbName} created successfully`);                  
        } catch (error) {
            console.error(`❌ Error creating database ${dbName}:`, error.message);
            throw new Error('Database creation failed');
        }   
    },

    insertDatabaseDetails: async (idCompany, dbName, client=pool) => {
        const query = 'INSERT INTO database_details (id_company, name) VALUES ($1, $2) RETURNING *';
        const values = [idCompany, dbName];
        try {
            const result = await client.query(query, values);
            return result.rows[0]; // Return the newly inserted database details
        } catch (error) {
            console.error('❌ Error inserting database details:', error.message);
            throw new Error('Database query failed');
        }
    },  

    updateStatusDatabase: async (idCompany, status) => {
        const query = 'UPDATE database_details SET status = $1 WHERE id_company = $2 RETURNING *';
        const values = [status, idCompany];
        try {
            const result = await pool.query(query, values);
            return result.rows[0]; // Return the updated database details
        } catch (error) {
            console.error('❌ Error updating database status:', error.message);
            throw new Error('Database query failed');
        }
    }
};

module.exports = { databaseModel };
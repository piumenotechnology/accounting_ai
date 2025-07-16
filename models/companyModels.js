const { pool } = require('../config/db');

const companyModels = {
    getCompanyById: async (companyId) =>{
        const query = 'SELECT * FROM companies WHERE id = $1';
        const values = [companyId];
        try {
            const result = await pool.query(query, values);
            return result.rows[0]; // Return the company found by ID
        } catch (error) {
            console.error('❌ Error fetching company by ID:', error.message);
            throw new Error('Database query failed');
        }
    },

    getCompanyBytoken: async (tokenId) => {
        const query = 'SELECT * FROM companies WHERE id_token = $1';
        const values = [tokenId]
        try {
            const result = await pool.query(query, values)
            return result.rows[0]
        } catch (error) {
            console.error('❌ Error fetching company by token id:', error.message);
            throw new Error('Database query failed');
        }
    },

    existCompany: async (email) => {
        const result = await pool.query('SELECT * FROM companies where email = $1', [email]);
        return result.rows[0]
    },

    getAllCompanies: async () => {},

    createCompany: async (name, email, password, app, client=pool) => {
        const query = 'INSERT INTO companies ( name, email, password, app ) VALUES ($1, $2, $3, $4) RETURNING *';
        const values = [name, email, password, app];
        try {
            const result = await client.query(query, values);

            return result.rows[0]; // Return the newly created company      
        } catch (error) {
            console.error('❌ Error creating company:', error.message);
            throw new Error('Database query failed');
        }
    },

    updateCompanyTokenAndDatabase: async (companyId, tokenId, dbId, client=pool) => {
        const query = 'UPDATE companies SET id_token = $1, id_database = $2 where id = $3 RETURNING *';
        const values = [tokenId, dbId, companyId];
        try {
            const result = await client.query(query, values);
            return result.rows[0]; // Return the updated company
        } catch (error) {
            console.error('❌ Error updating company token:', error.message);
            throw new Error('Database query failed');
        }   
    },

    updateCompany: async () => {},
    deleteCompany: async () => {},

}

module.exports = {companyModels};
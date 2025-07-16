const { pool } = require('../config/db');

const tokenModel = {
    createToken: async (token, client = pool) => {
        const query = 'INSERT INTO tokens (token, status, remains) VALUES ($1, $2, $3) RETURNING *';
        const values = [token, true, 10]; // Default status is 'active' and remains is 0
        try {
            const result = await client.query(query, values);
            return result.rows[0]; // Return the newly created token
        } catch (error) {
            console.error('❌ Error creating token:', error.message);
            throw new Error('Database query failed');
        }
    },

    updateToken: async (tokenId, newStatus, newRemains, client = pool) => {
        const query = 'UPDATE tokens SET status = $1, remains = $2 token = $3 RETURNING *';
        const values = [newStatus, newRemains, tokenId];
        try {
            const result = await client.query(query, values);
            return result.rows[0]; // Return the updated token
        } catch (error) {
            console.error('❌ Error updating token:', error.message);
            throw new Error('Database query failed');
        }
    },

    deleteToken: async (tokenId) => {
        const query = 'DELETE FROM tokens WHERE token = $1 RETURNING *';
        const values = [tokenId];
        try {
            const result = await pool.query(query, values);
            return result.rows[0]; // Return the deleted token
        } catch (error) {
            console.error('❌ Error deleting token:', error.message);
            throw new Error('Database query failed');
        }
    },

    checkToken: async (tokenCode) => {
        const query = 'SELECT * FROM tokens where token = $1';
        const values = [tokenCode]
        try {
            const result = await pool.query(query, values);
            return result.rows[0]
        } catch (error) {
            console.error('❌ Error get token:', error.message);
            throw new Error('Database check token failed');
        }
    }
}

module.exports = {tokenModel};
const pool = require('../config/db'); 

const authModels = {
    getUserByEmail: async (email) => {
        const query = 'SELECT * FROM users WHERE email = $1';
        const values = [email];
        try {
            const result = await pool.query(query, values);
            return result.rows[0]; // Return the first user found   
        } catch (error) {
            console.error('❌ Error fetching user by email:', error.message);
            throw new Error('Database query failed');
        }
    },
    createUser: async (userData) => {
        const { name, email, password } = userData;
        const query = 'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING *';
        const values = [name, email, password];
        try {
            const result = await pool.query(query, values);
            return result.rows[0]; // Return the newly created user
        } catch (error) {
            console.error('❌ Error creating user:', error.message);
            throw new Error('Database query failed');
        }
    },
    updateUserPassword: async (userId, newPassword) => {
        const query = 'UPDATE users SET password = $1 WHERE id = $2 RETURNING *';
        const values = [newPassword, userId];
        try {
            const result = await pool.query(query, values);
            return result.rows[0]; // Return the updated user
        } catch (error) {
            console.error('❌ Error updating user password:', error.message);
            throw new Error('Database query failed');
        }
    },
    getUserById: async (userId) => {
        const query = 'SELECT * FROM users WHERE id = $1';
        const values = [userId];
        try {
            const result = await pool.query(query, values);
            return result.rows[0]; // Return the user found by ID
        } catch (error) {
            console.error('❌ Error fetching user by ID:', error.message);
            throw new Error('Database query failed');
        }
    },
    deleteUser: async (userId) => {
        const query = 'DELETE FROM users WHERE id = $1 RETURNING *';
        const values = [userId];
        try {
            const result = await pool.query(query, values);
            return result.rows[0]; // Return the deleted user
        } catch (error) {
            console.error('❌ Error deleting user:', error.message);
            throw new Error('Database query failed');
        }
    },
    getAllUsers: async () => {
        const query = 'SELECT * FROM users';
        try {
            const result = await pool.query(query);
            return result.rows; // Return all users
        } catch (error) {
            console.error('❌ Error fetching all users:', error.message);
            throw new Error('Database query failed');
        }
    }
}

module.exports = authModels;
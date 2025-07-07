const { hashPassword, comparePasswords, generateToken } = require('../services/auth/tokenServices');
const authModels = require('../models/authModels');

const auth = {
    register: async (req, res) => {
        try{
            const { name, email, password } = req.body;
            if (!name || !email || !password) {
                return res.status(400).json({ error: 'Name, email, and password are required' });
            }
            const existingUser = await authModels.getUserByEmail(email);
            if (existingUser) {
                return res.status(400).json({ error: 'User already exists' });
            }
            const hashedPassword = await hashPassword(password);
            const newUser = await authModels.createUser({ name, email, password: hashedPassword });
            const token = generateToken(newUser);
            res.status(201).json({ user: {name: newUser.name, email: newUser.email }, token });
        } catch (error) {
            console.error('❌ Error during registration:', error.message);
            res.status(500).json({ error: 'Registration failed' });
        }
    },
    login: async (req, res) => {
        try {
            const { email, password } = req.body;
            if (!email || !password) {
                return res.status(400).json({ error: 'Email and password are required' });
            }
            const user = await authModels.getUserByEmail(email);
            if (!user) {
                return res.status(401).json({ error: 'Invalid email or password' });
            }
            const isPasswordValid = await comparePasswords(password, user.password);
            if (!isPasswordValid) {
                return res.status(401).json({ error: 'Invalid email or password' });
            }
            const token = generateToken(user);
            res.json({ user: { id: user.id, name: user.name, email: user.email }, token });
        } catch (error) {
            console.error('❌ Error during login:', error.message);
            res.status(500).json({ error: 'Login failed' });
        }
    },
    getUser: async (req, res) => {
        try {
            const userId = req.user.id; // Assuming user ID is stored in req.user
            const user = await authModels.getUserById(userId);
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }
            res.json({ user: { id: user.id, name: user.name, email: user.email } });
        } catch (error) {
            console.error('❌ Error fetching user:', error.message);
            res.status(500).json({ error: 'Failed to fetch user' });
        }
    },
    updatePassword: async (req, res) => {
        try {
            const userId = req.user.id; 
            const { currentPassword, newPassword } = req.body;
            if (!currentPassword || !newPassword) {
                return res.status(400).json({ error: 'Current and new passwords are required' });
            }
            const user = await authModels.getUserById(userId);
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }
            const isCurrentPasswordValid = await comparePasswords(currentPassword, user.password);
            if (!isCurrentPasswordValid) {
                return res.status(401).json({ error: 'Current password is incorrect' });
            }
            const hashedNewPassword = await hashPassword(newPassword);
            const updatedUser = await authModels.updateUserPassword(userId, hashedNewPassword);
            res.json({ user: { id: updatedUser.id, name: updatedUser.name, email: updatedUser.email } });
        } catch (error) {
            console.error('❌ Error updating password:', error.message);
            res.status(500).json({ error: 'Failed to update password' });
        }
    },
    deleteUser: async (req, res) => {
        try {
            const userId = req.user.id; 
            const deletedUser = await authModels.deleteUser(userId);
            if (!deletedUser) {
                return res.status(404).json({ error: 'User not found' });
            }
            res.json({ message: 'User deleted successfully' });
        } catch (error) {
            console.error('❌ Error deleting user:', error.message);
            res.status(500).json({ error: 'Failed to delete user' });
        }
    },
    getAllUsers: async (req, res) => {
        try {
            const users = await authModels.getAllUsers();
            res.json(users);
        } catch (error) {
            console.error('❌ Error fetching all users:', error.message);
            res.status(500).json({ error: 'Failed to fetch users' });
        }
    }   
};

module.exports = auth;
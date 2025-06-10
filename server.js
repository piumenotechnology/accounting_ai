const express = require('express');
const app = express();
const cors = require('cors')
require('dotenv').config();
const { connectRedis } = require('./services/redisClient');
const { runSQL } = require('./services/databaseService');

// Import Routes
const chatRoutes = require('./routes/chatRoutes');
const importRoutes = require('./routes/importRoutes');
const authRoutes = require('./routes/authRoutes');

app.use(cors());

connectRedis(); // 🔌 Connect to Redis

// Middleware
app.use(express.json());

// API Routes
app.use('/chat', chatRoutes);
app.use('/import', importRoutes);
app.use('/auth', authRoutes);

// Health Check
app.get('/', (req, res) => {
  res.send('🚀 Assistant Backend is Running!');
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

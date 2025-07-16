const express = require('express');
const app = express();
const cors = require('cors')
const cron = require('node-cron');
require('dotenv').config();
// const { connectRedis } = require('./services/redisClient');

// Import Routes
const { runImportJob } = require('./controllers/importController');
const chatRoutes = require('./routes/chatRoutes');
const importRoutes = require('./routes/importRoutes');
const authRoutes = require('./routes/authRoutes');
const setupRoutes = require('./routes/setUpRoutes');

app.use(cors());

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

cron.schedule('0 */2 * * *', async () => {
  console.log('🔁 Running cron import task every 6 hours...');
  try {
    await runImportJob();
  } catch (err) {
    console.error('❌ Cron import failed:', err.message);
  }
});

// // API Routes
app.use('/chat', chatRoutes);
app.use('/import', importRoutes);
app.use('/auth', authRoutes);
app.use('/setup', setupRoutes);

// Health Check
app.get('/', (req, res) => {
  res.send('🚀 Assistant Backend is Running!');
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

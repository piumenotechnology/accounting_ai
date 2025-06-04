const express = require('express');
const app = express();
const cors = require('cors')
require('dotenv').config();
const { connectRedis } = require('./services/redisClient');
const { runSQL } = require('./services/databaseService');

app.use(cors());

connectRedis(); // 🔌 Connect to Redis

// Import Routes
const chatRoutes = require('./routes/chatRoutes');
const importRoutes = require('./routes/importRoutes');
const {fetchAllSheetsData} = require('./services/insert/googleSheetsService')

// Middleware
app.use(express.json());

// API Routes
app.use('/chat', chatRoutes);
app.use('/import', importRoutes);

app.get('/checkSheet', async(req, res)=> {
  try {
    const data = await fetchAllSheetsData();
    res.json(data);
  } catch (error) {
    console.error('❌ Error fetching sheet data:', error.message);
    res.status(500).json({ error: 'Failed to fetch sheet data' });
  }
})

app.get('/check_input', async(req, res) => {
  try {
    const { session_id, message, table } = req.query;

    if (!session_id || ! message || !table) {
      return res.status(400).json({ error: 'Missing input parameter' });
    }

    console.log(`🔍 Checking input: session_id=${session_id}, message=${message}, table=${table}`);

    return res.json({
      session_id,
      message,  
      table
    });

  } catch (error) {
    console.error('❌ Error checking input:', error.message);
    res.status(500).json({ error: 'Failed to check input' });
  }
})


app.get('/cekDB', async (req, res) => {
  try {

    let result;

    result = await runSQL("SELECT * FROM ap where supplier='denoise.com' ");

    res.json(result);

  } catch (error) {
    console.error('❌ Error fetching sheet data:', error.message);
    res.status(500).json({ error: 'Failed to fetch sheet data' });
  }
})

// Health Check
app.get('/', (req, res) => {
  res.send('🚀 Assistant Backend is Running!');
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

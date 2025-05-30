const { loadChain } = require('../services/chat/chainService');

async function handleChat(req, res) {
  try {
    const { session_id, message, table } = req.body;

    if (!session_id || !message) {
      return res.status(400).json({
        error: 'Missing session_id or message'
      });
    }

    const chain = await loadChain(session_id); // Load the chain for the session
    
    const response = await chain({ input: message.toLowerCase(), table: table.toLowerCase() }); // Pass the table name to the chain
    
    // console.log(`💬 [${session_id}] ${message}`);

    res.json({ response });
  } catch (error) {
    console.error('❌ Error in handleChat:', error.message);
    res.status(500).json({
      error: 'Failed to process message'
    });
  }
}

module.exports = { handleChat };



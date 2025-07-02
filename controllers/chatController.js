const { loadChain } = require('../services/chat/chainService');
const { fastChain } = require('../services/chat/fastChainService');
const { cleanupOldSessions } = require('../services/chat/memoryServicePostgres')

async function handleChat(req, res) {
  try {
    const { session_id, message, table } = req.body;
    // const { session_id, message, table } =  req.query;

    if (!session_id || !message) {
      return res.status(400).json({
        error: 'Missing session_id or message'
      });
    }

    const chain = await loadChain(session_id); // Load the chain for the session
    // const chain = await fastChain(session_id); // Load the chain for the session
    
    const response = await chain({ input: message.toLowerCase(), table: table.toLowerCase() });

    res.json({ "data":response });
  } catch (error) {
    console.error('❌ Error in handleChat:', error.message);
    res.status(500).json({
      error: 'Failed to process message'
    });
  }
}

async function deleteChatHistory(req, res) {
  try {
    const clearData = await cleanupOldSessions();
    if (!clearData) {
      return res.status(500).json({
        error: 'Failed to clear chat history'
      });
    }

    res.json({ message: 'Chat history deleted successfully' });
  } catch (error) {
    console.error('❌ Error in deleteChatHistory:', error.message);
    res.status(500).json({
      error: 'Failed to delete chat history'
    });
  }
}

module.exports = { handleChat, deleteChatHistory };



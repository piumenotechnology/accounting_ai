const { loadChain } = require('../services/chat/chainService');
const { chatHistory } = require('../services/chat/chatHistory');

async function handleChat(req, res) {
  try {
    const { user_email, chat_id, message, table } = req.body;
    // const { session_id, message, table } =  req.query;

    if (!user_email || !chat_id || !message) {
      return res.status(400).json({
        error: 'Missing id or message'
      });
    }

    const chain = await loadChain(user_email, chat_id); // Load the chain for the session
    // const chain = await fastChain(session_id); // Load the chain for the session

    if (!chain) {
      return res.status(500).json({
        error: 'Failed to load chat chain'
      });
    }
    
    const response = await chain({ input: message.toLowerCase(), table: table.toLowerCase() });

    if (!response) {
      return res.status(500).json({
        error: 'Failed to get response from chat chain'
      });
    }

    res.json({ "data":response });
  } catch (error) {
    console.error('❌ Error in handleChat new:', error.message);
    res.status(500).json({
      error: 'Failed to process message'
    });
  }
}

// async function cleanOldChat(req, res) {
//   try {
//     const clearData = await cleanupOldSessions();
//     if (!clearData) {
//       return res.status(500).json({
//         error: 'Failed to clear chat history'
//       });
//     }
//     res.json({ message: 'Chat history deleted successfully' });
//   } catch (error) {
//     console.error('❌ Error in cleanOldChat:', error.message);
//     res.status(500).json({
//       error: 'Failed to delete chat history'
//     });
//   }
// }

// async function getAllChatHistory(req, res) {
//   try {
//     const { user_email } = req.query;

//     if (!user_email) {
//       return res.status(400).json({
//         error: 'Missing user_email'
//       });
//     }
//     const history = await allChatHistory(user_email);
//     if (!history) {
//       return res.status(404).json({
//         error: 'Chat history not found'
//       });
//     }
//     res.json({data: history});
//   } catch (error) {
//     console.error('❌ Error in getAllChatHistory:', error.message);
//     res.status(500).json({
//       error: 'Failed to retrieve chat history'
//     });
//   }
// }

// async function getChatHistory(req, res) {
//   try {
//     const { user_email, chat_id } = req.query;

//     if (!user_email || !chat_id) {
//       return res.status(400).json({
//         error: 'Missing user_email or chat_id'
//       });
//     }
//     const history = await chatHistory(user_email, chat_id);
//     if (!history) {
//       return res.status(404).json({
//         error: 'Chat history not found'
//       });
//     }
//     res.json({data: history});
//   } catch (error) {
//     console.error('❌ Error in getChatHistory:', error.message);
//     res.status(500).json({
//       error: 'Failed to retrieve chat history'
//     });
//   }
// }

// async function deleteChat(req, res){
//   try {
//     const { user_email, chat_id} = req.query;
//     if (!user_email || !chat_id) {
//       return res.status(400).json({
//         error: 'Missing user_email or chat_id'
//       });
//     }
//     const deleted = await deleteChatHistory(user_email, chat_id);
//     if (!deleted) {
//       return res.status(404).json({
//         error: 'Chat history not found'
//       });
//     }
//     res.json({ message: 'Chat history deleted successfully' });
//   }
//   catch (error) {
//     console.error('❌ Error in deleteChat:', error.message);
//     res.status(500).json({
//       error: 'Failed to delete chat history'
//     });
//   }
// }


// Get all chat messages for a user
async function getAllChatHistory(req, res) {
  try {
    const { user_email } = req.query;

    if (!user_email) {
      return res.status(400).json({ error: 'Missing user_email' });
    }

    const chat = chatHistory(user_email, null); // null chat_id means all chats
    const result = await chat.getAllMessages();

    if (!result.length) {
      return res.status(404).json({ error: 'No chat history found' });
    }

    res.json({ data: result });
  } catch (error) {
    console.error('❌ Error in getAllChatHistory:', error.message);
    res.status(500).json({ error: 'Failed to retrieve chat history' });
  }
}

// Get messages for a specific chat
async function getChatHistory(req, res) {
  try {
    const { user_email, chat_id } = req.query;

    if (!user_email || !chat_id) {
      return res.status(400).json({ error: 'Missing user_email or chat_id' });
    }

    const chat = chatHistory(user_email, chat_id);
    const messages = await chat.getMessages();

    if (!messages.length) {
      return res.status(404).json({ error: 'Chat history not found' });
    }

    res.json({ data: messages });
  } catch (error) {
    console.error('❌ Error in getChatHistory:', error.message);
    res.status(500).json({ error: 'Failed to retrieve chat history' });
  }
}

// Delete a chat's messages and metadata
async function deleteChat(req, res) {
  try {
    const { user_email, chat_id } = req.query;

    if (!user_email || !chat_id) {
      return res.status(400).json({ error: 'Missing user_email or chat_id' });
    }

    const chat = chatHistory(user_email, chat_id);
    const deletedMessages = await chat.deleteMessages();
    const deletedMetadata = await chat.deleteMetadata();

    if (deletedMessages === 0 && deletedMetadata === 0) {
      return res.status(404).json({ error: 'Nothing to delete for this chat' });
    }

    res.json({ message: `Deleted ${deletedMessages} messages and metadata.` });
  } catch (error) {
    console.error('❌ Error in deleteChat:', error.message);
    res.status(500).json({ error: 'Failed to delete chat history' });
  }
}

module.exports = {
  handleChat,
  getAllChatHistory,
  getChatHistory,
  deleteChat
};



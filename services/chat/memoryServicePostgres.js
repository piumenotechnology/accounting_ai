const {pgClient} = require('../databaseService');


// async function initializeDatabase() {

//   try {
//     // Create chat_messages table
//     await pgClient.query(`
//       CREATE TABLE IF NOT EXISTS chat_messages (
//         id SERIAL PRIMARY KEY,
//         session_id VARCHAR(255) NOT NULL,
//         role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'human', 'ai')),
//         content TEXT NOT NULL,
//         created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
//         is_successful BOOLEAN DEFAULT true,
//         has_error BOOLEAN DEFAULT false
//       )
//     `);

//     // Create session_metadata table
//     await pgClient.query(`
//       CREATE TABLE IF NOT EXISTS session_metadata (
//         session_id VARCHAR(255) PRIMARY KEY,
//         last_successful_table VARCHAR(100),
//         last_sql TEXT,
//         last_result_count INTEGER DEFAULT 0,
//         last_execution_time INTEGER DEFAULT 0,
//         recent_failures INTEGER DEFAULT 0,
//         last_error TEXT,
//         last_failed_sql TEXT,
//         last_query_empty BOOLEAN DEFAULT false,
//         continuity_analysis JSONB,
//         conversation_turns INTEGER DEFAULT 0,
//         created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
//         last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
//       )
//     `);

//     // Create indexes for better performance
//     await pgClient.query(`
//       CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id 
//       ON chat_messages(session_id)
//     `);
    
//     await pgClient.query(`
//       CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at 
//       ON chat_messages(created_at)
//     `);
    
//     await pgClient.query(`
//       CREATE INDEX IF NOT EXISTS idx_chat_messages_successful 
//       ON chat_messages(session_id, is_successful, created_at)
//     `);

//     console.log('✅ Database tables initialized successfully');
//   } catch (error) {
//     console.error('❌ Error initializing database:', error);
//     throw error;
//   }
// }

// Chat History Class to mimic the interface expected by your main code
class ChatHistory {
  constructor(sessionId) {
    this.sessionId = sessionId;
  }
  async addUserMessage(content) {
    try {
      await pgClient.query(
        'INSERT INTO chat_messages (session_id, role, content, is_successful) VALUES ($1, $2, $3, $4)',
        [this.sessionId, 'user', content, true]
      );
    } catch (error) {
      console.error('Error adding user message:', error);
      throw error;
    }
  }

  async addAIMessage(content, isSuccessful = true) {
    try {
      const hasError = content.includes('Query error:') || 
                      content.includes('SQL Error:') || 
                      content.includes('encountered an error');
      
      await pgClient.query(
        'INSERT INTO chat_messages (session_id, role, content, is_successful, has_error) VALUES ($1, $2, $3, $4, $5)',
        [this.sessionId, 'assistant', content, isSuccessful && !hasError, hasError]
      );
    } catch (error) {
      console.error('Error adding AI message:', error);
      throw error;
    }
  }

  async getMessages(limit = 50) {
    try {
      const result = await pgClient.query(
        `SELECT role, content, created_at, is_successful, has_error 
         FROM chat_messages 
         WHERE session_id = $1 
         ORDER BY created_at DESC 
         LIMIT $2`,
        [this.sessionId, limit]
      );
      
      return result.rows.reverse().map(row => ({
        role: row.role,
        content: row.content,
        created_at: row.created_at,
        is_successful: row.is_successful,
        has_error: row.has_error,
        _getType: () => row.role === 'user' ? 'human' : 'ai'
      }));
    } catch (error) {
      console.error('Error getting messages:', error);
      return [];
    }
  }
}

// Get chat history instance for a session
function getChatHistory(sessionId) {
  return new ChatHistory(sessionId);
}

// Get all messages for a session (including failed ones)
async function getChatMessages(sessionId, limit = 50) {
  const chatHistory = getChatHistory(sessionId);
  return await chatHistory.getMessages(limit);
}

// Get only successful messages (filters out failed queries)
async function getSuccessfulQueriesOnly(sessionId, limit = 20) {
  try {
    const result = await pgClient.query(
      `SELECT role, content, created_at 
       FROM chat_messages 
       WHERE session_id = $1 AND is_successful = true AND has_error = false
       ORDER BY created_at DESC 
       LIMIT $2`,
      [sessionId, limit]
    );
    
    return result.rows.reverse().map(row => ({
      role: row.role,
      content: row.content,
      created_at: row.created_at,
      _getType: () => row.role === 'user' ? 'human' : 'ai'
    }));
  } catch (error) {
    console.error('Error getting successful queries:', error);
    return [];
  }
}

// Get session metadata
async function getSessionMetadata(sessionId) {
  try {
    const result = await pgClient.query(
      'SELECT * FROM session_metadata WHERE session_id = $1',
      [sessionId]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const metadata = result.rows[0];
    // Parse JSON fields
    if (metadata.continuity_analysis) {
      metadata.continuity_analysis = metadata.continuity_analysis;
    }
    
    return metadata;
  } catch (error) {
    console.error('Error getting session metadata:', error);
    return null;
  }
}

// Set/update session metadata
async function setSessionMetadata(sessionId, metadata) {
  try {
    // Convert continuity_analysis to JSON if it exists
    const continuityAnalysisJson = metadata.continuity_analysis ? 
      JSON.stringify(metadata.continuity_analysis) : null;

    await pgClient.query(
      `INSERT INTO session_metadata (
        session_id, last_successful_table, last_sql, last_result_count,
        last_execution_time, recent_failures, last_error, last_failed_sql,
        last_query_empty, continuity_analysis, conversation_turns, last_updated
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (session_id) 
      DO UPDATE SET
        last_successful_table = COALESCE($2, session_metadata.last_successful_table),
        last_sql = COALESCE($3, session_metadata.last_sql),
        last_result_count = COALESCE($4, session_metadata.last_result_count),
        last_execution_time = COALESCE($5, session_metadata.last_execution_time),
        recent_failures = COALESCE($6, session_metadata.recent_failures),
        last_error = COALESCE($7, session_metadata.last_error),
        last_failed_sql = COALESCE($8, session_metadata.last_failed_sql),
        last_query_empty = COALESCE($9, session_metadata.last_query_empty),
        continuity_analysis = COALESCE($10, session_metadata.continuity_analysis),
        conversation_turns = COALESCE($11, session_metadata.conversation_turns),
        last_updated = $12`,
      [
        sessionId,
        metadata.last_successful_table || null,
        metadata.last_sql || null,
        metadata.last_result_count || null,
        metadata.last_execution_time || null,
        metadata.recent_failures || null,
        metadata.last_error || null,
        metadata.last_failed_sql || null,
        metadata.last_query_empty || null,
        continuityAnalysisJson,
        metadata.conversation_turns || null,
        metadata.last_updated || new Date().toISOString()
      ]
    );
  } catch (error) {
    console.error('Error setting session metadata:', error);
    throw error;
  }
}

// Clear failed queries for a session (cleanup function)
async function clearFailedQueries(sessionId, olderThanMinutes = 60) {
  try {
    const cutoffTime = new Date(Date.now() - olderThanMinutes * 60 * 1000);
    
    const result = await pgClient.query(
      `DELETE FROM chat_messages 
       WHERE session_id = $1 
       AND (has_error = true OR is_successful = false)
       AND created_at < $2`,
      [sessionId, cutoffTime]
    );
    
    console.log(`🧹 Cleared ${result.rowCount} failed queries for session ${sessionId}`);
    return result.rowCount;
  } catch (error) {
    console.error('Error clearing failed queries:', error);
    return 0;
  }
}

// Get session statistics
async function getSessionStats(sessionId) {
  try {
    const result = await pgClient.query(
      `SELECT 
        COUNT(*) as total_messages,
        COUNT(*) FILTER (WHERE role = 'user') as user_messages,
        COUNT(*) FILTER (WHERE role = 'assistant') as ai_messages,
        COUNT(*) FILTER (WHERE is_successful = true) as successful_messages,
        COUNT(*) FILTER (WHERE has_error = true) as error_messages,
        MIN(created_at) as first_message,
        MAX(created_at) as last_message
       FROM chat_messages 
       WHERE session_id = $1`,
      [sessionId]
    );
    
    return result.rows[0];
  } catch (error) {
    console.error('Error getting session stats:', error);
    return null;
  }
}

// Cleanup old sessions (maintenance function)
async function cleanupOldSessions(daysOld = 30) {

  try {
    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
    
    // Delete old messages
    const messageResult = await pgClient.query(
      'DELETE FROM chat_messages WHERE created_at < $1',
      [cutoffDate]
    );
    
    // Delete old metadata
    const metadataResult = await pgClient.query(
      'DELETE FROM session_metadata WHERE last_updated < $1',
      [cutoffDate]
    );
    
    console.log(`🧹 Cleanup: Removed ${messageResult.rowCount} messages and ${metadataResult.rowCount} metadata records older than ${daysOld} days`);
    
    return {
      messagesDeleted: messageResult.rowCount,
      metadataDeleted: metadataResult.rowCount
    };
  } catch (error) {
    console.error('Error during cleanup:', error);
    return { messagesDeleted: 0, metadataDeleted: 0 };
  }
}

// Initialize on module load
// initializeDatabase().catch(console.error);

module.exports = {
  // Core functions used by your main code
  getChatHistory,
  getSessionMetadata,
  setSessionMetadata,
  clearFailedQueries,
  getSuccessfulQueriesOnly,
  
  // Additional utility functions
  getChatMessages,
  getSessionStats,
  cleanupOldSessions,
//   initializeDatabase,
};
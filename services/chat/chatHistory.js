const { pgClient } = require('../databaseService');

class ChatHistory {
  constructor(userId, chatId) {
    this.userId = userId;
    this.chatId = chatId;
  }

  async addUserMessage(content) {
    try {
      await pgClient.query(
        'INSERT INTO chat_messages (user_id, chat_id, role, content, is_successful) VALUES ($1, $2, $3, $4, $5)',
        [this.userId, this.chatId, 'user', content, true]
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
        'INSERT INTO chat_messages (user_id, chat_id, role, content, is_successful, has_error) VALUES ($1, $2, $3, $4, $5, $6)',
        [this.userId, this.chatId, 'assistant', content, isSuccessful && !hasError, hasError]
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
         WHERE user_id = $1 AND chat_id = $2
         ORDER BY created_at DESC 
         LIMIT $3`,
        [this.userId, this.chatId, limit]
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

function getChatHistory(userId, chatId) {
  return new ChatHistory(userId, chatId);
}

async function getSuccessfulQueriesOnly(userId, chatId, limit = 20) {
  try {
    const result = await pgClient.query(
      `SELECT role, content, created_at 
       FROM chat_messages 
       WHERE user_id = $1 AND chat_id = $2 AND is_successful = true AND has_error = false
       ORDER BY created_at DESC 
       LIMIT $3`,
      [userId, chatId, limit]
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

async function getSessionMetadata(userId, chatId) {
  try {
    const result = await pgClient.query(
      'SELECT * FROM chat_metadata WHERE user_id = $1 AND chat_id = $2',
      [userId, chatId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const metadata = result.rows[0];
    if (metadata.continuity_analysis) {
      metadata.continuity_analysis = metadata.continuity_analysis;
    }

    return metadata;
  } catch (error) {
    console.error('Error getting session metadata:', error);
    return null;
  }
}

async function setSessionMetadata(userId, chatId, metadata) {
  try {
    const continuityAnalysisJson = metadata.continuity_analysis ? 
      JSON.stringify(metadata.continuity_analysis) : null;

    await pgClient.query(
      `INSERT INTO chat_metadata (
        user_id, chat_id, last_successful_table, last_sql, last_result_count,
        last_execution_time, recent_failures, last_error, last_failed_sql,
        last_query_empty, continuity_analysis, conversation_turns, last_updated
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (user_id, chat_id) 
      DO UPDATE SET
        last_successful_table = COALESCE($3, chat_metadata.last_successful_table),
        last_sql = COALESCE($4, chat_metadata.last_sql),
        last_result_count = COALESCE($5, chat_metadata.last_result_count),
        last_execution_time = COALESCE($6, chat_metadata.last_execution_time),
        recent_failures = COALESCE($7, chat_metadata.recent_failures),
        last_error = COALESCE($8, chat_metadata.last_error),
        last_failed_sql = COALESCE($9, chat_metadata.last_failed_sql),
        last_query_empty = COALESCE($10, chat_metadata.last_query_empty),
        continuity_analysis = COALESCE($11, chat_metadata.continuity_analysis),
        conversation_turns = COALESCE($12, chat_metadata.conversation_turns),
        last_updated = $13`,
      [
        userId,
        chatId,
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

async function clearFailedQueries(userId, chatId, olderThanMinutes = 60) {
  try {
    const cutoffTime = new Date(Date.now() - olderThanMinutes * 60 * 1000);
    
    const result = await pgClient.query(
      `DELETE FROM chat_messages 
       WHERE user_id = $1 
       AND chat_id = $2
       AND (has_error = true OR is_successful = false)
       AND created_at < $3`,
      [userId, chatId, cutoffTime]
    );
    
    console.log(`🧹 Cleared ${result.rowCount} failed queries for session ${userId }-${chatId} older than ${olderThanMinutes} minutes.`);
    return result.rowCount;
  } catch (error) {
    console.error('Error clearing failed queries:', error);
    return 0;
  }
}

module.exports = {
  getChatHistory,
  getSessionMetadata,
  setSessionMetadata,
  clearFailedQueries,
  getSuccessfulQueriesOnly,
};

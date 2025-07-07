// const { pgClient } = require('../databaseService');

// class ChatHistory {
//   constructor(user_id, chat_id) {
//     this.user_id = user_id;
//     this.chat_id = chat_id;
//   }

//   async addUserMessage(content) {
//     try {
//       await pgClient.query(
//         'INSERT INTO chat_messages_new (user_id, chat_id, role, content, is_successful) VALUES ($1, $2, $3, $4, $5)',
//         [this.user_id, this.chat_id, 'user', content, true]
//       );
//     } catch (error) {
//       console.error('Error adding user message:', error);
//       throw error;
//     }
//   }

//   async addAIMessage(content, isSuccessful = true) {
//     try {
//       const hasError = content.includes('Query error:') || 
//                        content.includes('SQL Error:') || 
//                        content.includes('encountered an error');

//       await pgClient.query(
//         'INSERT INTO chat_messages_new (user_id, chat_id, role, content, is_successful, has_error) VALUES ($1, $2, $3, $4, $5, $6)',
//         [this.user_id, this.chat_id, 'assistant', content, isSuccessful && !hasError, hasError]
//       );
//     } catch (error) {
//       console.error('Error adding AI message:', error);
//       throw error;
//     }
//   }

//   async getMessages(limit = 50) {
//     try {
//       const result = await pgClient.query(
//         `SELECT role, content, created_at, is_successful, has_error 
//          FROM chat_messages_new 
//          WHERE user_id = $1 AND chat_id = $2
//          ORDER BY created_at DESC 
//          LIMIT $3`,
//         [this.user_id, this.chat_id, limit]
//       );

//       return result.rows.reverse().map(row => ({
//         role: row.role,
//         content: row.content,
//         created_at: row.created_at,
//         is_successful: row.is_successful,
//         has_error: row.has_error,
//         _getType: () => row.role === 'user' ? 'human' : 'ai'
//       }));
//     } catch (error) {
//       console.error('Error getting messages:', error);
//       return [];
//     }
//   }
// }

// function getChatHistory(user_id, chat_id) {
//   return new ChatHistory(user_id, chat_id);
// }

// async function getSuccessfulQueriesOnly(user_id, chat_id, limit = 20) {
//   try {
//     const result = await pgClient.query(
//       `SELECT role, content, created_at 
//        FROM chat_messages_new 
//        WHERE user_id = $1 AND chat_id = $2 AND is_successful = true AND has_error = false
//        ORDER BY created_at DESC 
//        LIMIT $3`,
//       [user_id, chat_id, limit]
//     );

//     return result.rows.reverse().map(row => ({
//       role: row.role,
//       content: row.content,
//       created_at: row.created_at,
//       _getType: () => row.role === 'user' ? 'human' : 'ai'
//     }));
//   } catch (error) {
//     console.error('Error getting successful queries:', error);
//     return [];
//   }
// }

// async function getChatMetadata(chat_id) {
//   try {
//     const result = await pgClient.query(
//       'SELECT * FROM chat_metadata where chat_id = $1',
//       [chat_id]
//     );

//     if (result.rows.length === 0) {
//       return null;
//     }

//     const metadata = result.rows[0];
//     if (metadata.continuity_analysis) {
//       metadata.continuity_analysis = metadata.continuity_analysis;
//     }

//     return metadata;
//   } catch (error) {
//     console.error('Error getting Chat metadata:', error);
//     return null;
//   }
// }

// async function setChatMetadata(user_id, chat_id, metadata) {
//   try {
//     const continuityAnalysisJson = metadata.continuity_analysis ? 
//       JSON.stringify(metadata.continuity_analysis) : null;

//     await pgClient.query(
//       `INSERT INTO chat_metadata (
//         chat_id, last_successful_table, last_sql, last_result_count,
//         last_execution_time, recent_failures, last_error, last_failed_sql,
//         last_query_empty, continuity_analysis, conversation_turns, last_updated
//       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
//       ON CONFLICT (chat_id) 
//       DO UPDATE SET
//         last_successful_table = COALESCE($2, chat_metadata.last_successful_table),
//         last_sql = COALESCE($3, chat_metadata.last_sql),
//         last_result_count = COALESCE($4, chat_metadata.last_result_count),
//         last_execution_time = COALESCE($5, chat_metadata.last_execution_time),
//         recent_failures = COALESCE($6, chat_metadata.recent_failures),
//         last_error = COALESCE($7, chat_metadata.last_error),
//         last_failed_sql = COALESCE($8, chat_metadata.last_failed_sql),
//         last_query_empty = COALESCE($9, chat_metadata.last_query_empty),
//         continuity_analysis = COALESCE($10, chat_metadata.continuity_analysis),
//         conversation_turns = COALESCE($11, chat_metadata.conversation_turns),
//         last_updated = $12`,
//       [
//         chat_id,
//         metadata.last_successful_table || null,
//         metadata.last_sql || null,
//         metadata.last_result_count || null,
//         metadata.last_execution_time || null,
//         metadata.recent_failures || null,
//         metadata.last_error || null,
//         metadata.last_failed_sql || null,
//         metadata.last_query_empty || null,
//         continuityAnalysisJson,
//         metadata.conversation_turns || null,
//         metadata.last_updated || new Date().toISOString()
//       ]
//     );
//   } catch (error) {
//     console.error('Error setting Chat metadata:', error);
//     throw error;
//   }
// }

// async function clearFailedQueries(user_id, chat_id, olderThanMinutes = 60) {
//   try {
//     const cutoffTime = new Date(Date.now() - olderThanMinutes * 60 * 1000);
    
//     const result = await pgClient.query(
//       `DELETE FROM chat_messages_new 
//        WHERE user_id = $1 
//        AND chat_id = $2
//        AND (has_error = true OR is_successful = false)
//        AND created_at < $3`,
//       [user_id, chat_id, cutoffTime]
//     );
    
//     console.log(`🧹 Cleared ${result.rowCount} failed queries for Chat ${user_id }-${chat_id} older than ${olderThanMinutes} minutes.`);
//     return result.rowCount;
//   } catch (error) {
//     console.error('Error clearing failed queries:', error);
//     return 0;
//   }
// }

// async function allChatHistory(user_id) {
//   try {
//     const result = await pgClient.query(
//       'SELECT * FROM chat_messages_new WHERE user_id = $1 ORDER BY created_at DESC',
//       [user_id]
//     );
    
//     return result.rows;
//   } catch (error) {
//     console.error('Error retrieving all chat history:', error);
//     return [];
//   }
// }

// async function chatHistory(user_id, chat_id) {
//   try {
//     const result = await pgClient.query(
//       'SELECT * FROM chat_messages_new WHERE user_id = $1 AND chat_id = $2',
//       [user_id, chat_id]
//     );
//     return result.rows; 
//   } catch (error) {
//     console.error('Error checking chat history existence:', error);
//     return false;
//   }
// }

// async function deleteChatHistory(user_id, chat_id) {
//   try {
//     const result = await pgClient.query(
//       'DELETE FROM chat_messages_new WHERE user_id = $1 AND chat_id = $2',
//       [user_id, chat_id]
//     );
//     console.log(`🗑️ Deleted ${result.rowCount} messages for Chat ${user_id}-${chat_id}`);
//     // Optionally, delete metadata as well
//     await pgClient.query(
//       'DELETE FROM chat_metadata WHERE chat_id = $1',
//       [chat_id]
//     );
//     console.log(`🗑️ Deleted metadata for Chat ${chat_id}`);
//     return result.rowCount;
//   } catch (error) {
//     console.error('Error deleting chat history:', error);
//     return 0;
//   }
// }

// module.exports = {
//   getChatHistory,
//   getChatMetadata,
//   setChatMetadata,
//   clearFailedQueries,
//   getSuccessfulQueriesOnly,
//   chatHistory,
//   deleteChatHistory,
//   allChatHistory,
//   ChatHistory
// };

const { pgClient } = require('../databaseService');

class ChatHistory {
  constructor(user_id, chat_id) {
    this.user_id = user_id;
    this.chat_id = chat_id;
  }

  async addUserMessage(content) {
    try {
      await pgClient.query(
        'INSERT INTO chat_messages_new (user_id, chat_id, role, content, is_successful) VALUES ($1, $2, $3, $4, $5)',
        [this.user_id, this.chat_id, 'user', content, true]
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
        'INSERT INTO chat_messages_new (user_id, chat_id, role, content, is_successful, has_error) VALUES ($1, $2, $3, $4, $5, $6)',
        [this.user_id, this.chat_id, 'assistant', content, isSuccessful && !hasError, hasError]
      );
    } catch (error) {
      console.error('Error adding AI message:', error);
      throw error;
    }
  }

  async getAllMessages() {
    try {
      const result = await pgClient.query(
        'SELECT * FROM chat_messages_new WHERE user_id = $1 ORDER BY created_at DESC',
        [this.user_id])
      return result.rows;
    } catch (error) { 
      console.error('Error retrieving all chat history:', error);
      return [];
    }
  }
  
  async getMessages(limit = 50) {
    try {
      const result = await pgClient.query(
        `SELECT role, content, created_at, is_successful, has_error 
         FROM chat_messages_new 
         WHERE user_id = $1 AND chat_id = $2
         ORDER BY created_at DESC 
         LIMIT $3`,
        [this.user_id, this.chat_id, limit]
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

  async getSuccessfulQueries(limit = 20) {
    try {
      const result = await pgClient.query(
        `SELECT role, content, created_at 
         FROM chat_messages_new 
         WHERE user_id = $1 AND chat_id = $2 AND is_successful = true AND has_error = false
         ORDER BY created_at DESC 
         LIMIT $3`,
        [this.user_id, this.chat_id, limit]
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

  async clearFailedQueries(olderThanMinutes = 60) {
    try {
      const cutoffTime = new Date(Date.now() - olderThanMinutes * 60 * 1000);

      const result = await pgClient.query(
        `DELETE FROM chat_messages_new 
         WHERE user_id = $1 
         AND chat_id = $2
         AND (has_error = true OR is_successful = false)
         AND created_at < $3`,
        [this.user_id, this.chat_id, cutoffTime]
      );

      console.log(`🧹 Cleared ${result.rowCount} failed queries for Chat ${this.user_id}-${this.chat_id} older than ${olderThanMinutes} minutes.`);
      return result.rowCount;
    } catch (error) {
      console.error('Error clearing failed queries:', error);
      return 0;
    }
  }

  async getMetadata() {
    try {
      const result = await pgClient.query(
        'SELECT * FROM chat_metadata WHERE chat_id = $1',
        [this.chat_id]
      );

      return result.rows.length ? result.rows[0] : null;
    } catch (error) {
      console.error('Error getting Chat metadata:', error);
      return null;
    }
  }

  async setMetadata(metadata) {
    try {
      const continuityAnalysisJson = metadata.continuity_analysis ? JSON.stringify(metadata.continuity_analysis) : null;

      await pgClient.query(
        `INSERT INTO chat_metadata (
          chat_id, last_successful_table, last_sql, last_result_count,
          last_execution_time, recent_failures, last_error, last_failed_sql,
          last_query_empty, continuity_analysis, conversation_turns, last_updated
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (chat_id) DO UPDATE SET
          last_successful_table = COALESCE($2, chat_metadata.last_successful_table),
          last_sql = COALESCE($3, chat_metadata.last_sql),
          last_result_count = COALESCE($4, chat_metadata.last_result_count),
          last_execution_time = COALESCE($5, chat_metadata.last_execution_time),
          recent_failures = COALESCE($6, chat_metadata.recent_failures),
          last_error = COALESCE($7, chat_metadata.last_error),
          last_failed_sql = COALESCE($8, chat_metadata.last_failed_sql),
          last_query_empty = COALESCE($9, chat_metadata.last_query_empty),
          continuity_analysis = COALESCE($10, chat_metadata.continuity_analysis),
          conversation_turns = COALESCE($11, chat_metadata.conversation_turns),
          last_updated = $12`,
        [
          this.chat_id,
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
      console.error('Error setting Chat metadata:', error);
      throw error;
    }
  }

  async deleteMessages() {
    try {
      const result = await pgClient.query(
        'DELETE FROM chat_messages_new WHERE user_id = $1 AND chat_id = $2',
        [this.user_id, this.chat_id]
      );
      console.log(`🗑️ Deleted ${result.rowCount} messages for Chat ${this.user_id}-${this.chat_id}`);
      return result.rowCount;
    } catch (error) {
      console.error('Error deleting chat messages:', error);
      return 0;
    }
  }

  async deleteMetadata() {
    try {
      const result = await pgClient.query(
        'DELETE FROM chat_metadata WHERE chat_id = $1',
        [this.chat_id]
      );
      console.log(`🗑️ Deleted metadata for Chat ${this.chat_id}`);
      return result.rowCount;
    } catch (error) {
      console.error('Error deleting chat metadata:', error);
      return 0;
    }
  }
}

function chatHistory(user_id, chat_id) {
  return new ChatHistory(user_id, chat_id);
}

module.exports = {
  chatHistory,
  ChatHistory
};


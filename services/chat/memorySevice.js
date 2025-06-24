const { pgClient } = require('../databaseService');

// --- CHAT HISTORY IMPLEMENTATION ---

function getChatHistory(sessionId) {
  return {
    async getMessages() {
      const res = await pgClient.query(
        `SELECT role, content FROM chat_history 
         WHERE session_id = $1 ORDER BY message_index ASC`,
        [sessionId]
      );
      return res.rows.map(row => ({
        role: row.role,
        content: row.content
      }));
    },

    async addUserMessage(content) {
      await pgClient.query(
        `INSERT INTO chat_history (session_id, role, content) 
         VALUES ($1, 'user', $2)`,
        [sessionId, content]
      );
    },

    async addAIMessage(content) {
      await pgClient.query(
        `INSERT INTO chat_history (session_id, role, content) 
         VALUES ($1, 'assistant', $2)`,
        [sessionId, content]
      );
    },

    async clear() {
      await pgClient.query(
        `DELETE FROM chat_history WHERE session_id = $1`,
        [sessionId]
      );
    }
  };
}

// --- SESSION METADATA STORAGE ---

async function getSessionMetadata(sessionId) {
  const res = await pgClient.query(
    `SELECT data FROM session_metadata WHERE session_id = $1`,
    [sessionId]
  );
  return res.rows[0]?.data || {};
}

async function setSessionMetadata(sessionId, data) {
  await pgClient.query(
    `INSERT INTO session_metadata (session_id, data) 
     VALUES ($1, $2)
     ON CONFLICT (session_id) DO UPDATE 
     SET data = EXCLUDED.data, updated_at = now()`,
    [sessionId, data]
  );
}

// --- OPTIONAL CLEANUP ---

async function deleteOldSessions(days = 7) {
  await pgClient.query(
    `DELETE FROM chat_history WHERE created_at < now() - interval '${days} days'`
  );
  await pgClient.query(
    `DELETE FROM session_metadata WHERE updated_at < now() - interval '${days} days'`
  );
}

// --- EXPORTS ---

module.exports = {
  getChatHistory,
  getSessionMetadata,
  setSessionMetadata,
  deleteOldSessions
};

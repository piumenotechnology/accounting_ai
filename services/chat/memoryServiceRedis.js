const { createClient } = require('redis');
const { RedisChatMessageHistory } = require('@langchain/redis');

const redis = createClient({
  url: process.env.REDIS_URL, 
});
redis.connect();

const memoryCache = {};

function getChatHistory(session_id) {
  if (!memoryCache[session_id]) {
    memoryCache[session_id] = new RedisChatMessageHistory({
      sessionId: session_id,
      client: redis,
      sessionTTL: 3600,
    });
  }
  return memoryCache[session_id];
}

const sessionMeta = {};

function getSessionMetadata(sessionId) {
  return Promise.resolve(sessionMeta[sessionId] || {});
}

function setSessionMetadata(sessionId, data) {
  sessionMeta[sessionId] = data;
  return Promise.resolve();
}

module.exports = {
  getChatHistory,
  getSessionMetadata,
  setSessionMetadata
};


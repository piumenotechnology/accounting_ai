const { ChatOpenAI } = require('@langchain/openai');
require('dotenv').config();

// Setup OpenAI LLM
const openai = new ChatOpenAI({
  openAIApiKey: process.env.OPENAI_API_KEY,
  modelName: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
  temperature: 0
});

module.exports = { openai };

// services/chat/detectSmallTalk.js
const { openai } = require("../../config/openai");

async function detectSmallTalk(input) {
  const chitchatPrompt = [
    {
      role: "system",
      content: `
You are a message classifier.

Classify the user input as one of:
- "chitchat" (greeting, thanks, filler, or casual talk)
- "question" (data-related, intent to query)
- "unknown"

Respond only with a JSON object:
{
  "type": "chitchat" | "question" | "unknown",
  "confidence": 0.0 - 1.0,
  "exampleIntent": "brief guess at user's intent"
}
      `.trim(),
    },
    {
      role: "user",
      content: input.trim(),
    },
  ];

  try {
    const response = await openai.invoke(chitchatPrompt);
    const result = JSON.parse(response.content);
    return result;
  } catch (err) {
    console.error("❌ Failed to classify small talk:", err.message);
    return { type: "unknown", confidence: 0.5 };
  }
}

module.exports = {
  detectSmallTalk,
};

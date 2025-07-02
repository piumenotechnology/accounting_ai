const express = require('express');
const router = express.Router();
const { handleChat, deleteChatHistory } = require('../controllers/chatController');

// POST /chat
router.post('/', handleChat);
router.delete('/deleter-history', deleteChatHistory);

module.exports = router;

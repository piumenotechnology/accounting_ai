const express = require('express');
const router = express.Router();
const { handleChat, deleteChat, getChatHistory, getAllChatHistory } = require('../controllers/chatController');

// POST /chat
router.post('/', handleChat);
router.delete('/history', deleteChat);
// GET /chat/history
router.get('/history', getChatHistory);
// GET /chat/history/all
router.get('/history/all', getAllChatHistory);

module.exports = router;

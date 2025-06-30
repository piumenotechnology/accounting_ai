const express = require('express');
const router = express.Router();
const { handleChat } = require('../controllers/chatController');

// POST /chat
router.post('/', handleChat);

module.exports = router;

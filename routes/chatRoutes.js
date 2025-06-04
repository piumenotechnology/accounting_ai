const express = require('express');
const router = express.Router();
const { handleChat } = require('../controllers/chatController');

// POST /chat
router.get('/', handleChat);

module.exports = router;

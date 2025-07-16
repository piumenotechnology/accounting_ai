const { create } = require('../controllers/createDatabase');
const express = require('express');
const router = express.Router();


// Route to create a new company
router.post('/create-company', create);

// Add more routes as needed
module.exports = router;


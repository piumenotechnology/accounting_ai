const express = require('express');
const router = express.Router();
const { handleImport } = require('../controllers/importController');

router.post('/', handleImport);

module.exports = router;

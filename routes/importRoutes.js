const express = require('express');
const router = express.Router();
const { handleImport, handleInsertBS, handleInsertPL, handleInsertCashFlow, getDataWithoutBackground1 } = require('../controllers/importController');

router.post('/', handleImport);
router.post('/pl', handleInsertPL);
router.post('/bs', handleInsertBS);
router.post('/cash-flow', handleInsertCashFlow);

// Import data without background color
router.get('/data-without-bg', getDataWithoutBackground1);

module.exports = router;

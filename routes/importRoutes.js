const express = require('express');
const router = express.Router();
const { handleImport, handleInsertBS, handleInsertPL, handleInsertCashFlow, handleImportALL } = require('../controllers/importController');

router.post('/', handleImport);
router.post('/pl', handleInsertPL);
router.post('/bs', handleInsertBS);
router.post('/cash-flow', handleInsertCashFlow);
router.post('/all', handleImportALL);

module.exports = router;

const express = require('express');
const router = express.Router();
const auth  = require('../controllers/authController');

// POST
router.post('/register', auth.register);
router.post('/login', auth.login);
router.post('/update-password', auth.updatePassword);
// GET
router.get('/user', auth.getUser);
// DELETE
router.delete('/delete', auth.deleteUser);
// GET ALL
router.get('/all', auth.getAllUsers);


module.exports = router;

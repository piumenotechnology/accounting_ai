const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const hashPassword = (password) => {
  return bcrypt.hash(password, 10);
};

const comparePasswords = (enteredPassword, storedPassword) => {
  return bcrypt.compare(enteredPassword, storedPassword);
};

const generateToken = (user) => {
  return jwt.sign(
    { userId: user.id, email: user.email },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: '1h' }
  );
};

module.exports = {
  hashPassword,
  comparePasswords,
  generateToken,
};

const express = require('express');
const { body, validationResult } = require('express-validator');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Placeholder for enrollment routes
router.get('/', (req, res) => {
  res.json({ message: 'Enrollment routes - to be implemented' });
});

module.exports = router;

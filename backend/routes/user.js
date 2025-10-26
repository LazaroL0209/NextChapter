const express = require('express');
const controller = require('../tables/user/controller');

const router = express.Router();

// Controllers
router.post('/login', controller.login);

module.exports = router;
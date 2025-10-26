const express = require('express');
const controller = require('../tables/player/controller');
const { protect, restrictTo } = require('../middleware/auth');

const router = express.Router();

router.post('/', protect, restrictTo('admin'), controller.createPlayer);
router.patch('/:id', protect, restrictTo('admin'), controller.updatePlayer);

// --- Public Data Retrieval ---
router.get('/', controller.searchPlayers);
router.get('/:id', controller.getPlayerById);
router.get('/:id/games', controller.getPlayerRecentGames);

module.exports = router;
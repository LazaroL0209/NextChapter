const Game = require('./model');
const Player = require('../player/model'); // Import Player model for stat updates
const mongoose = require('mongoose');

// --- Helper Functions ---
const _internalCalculateStats = (game) => {
    const statsSummary = new Map(); // Use a Map to store stats per player ID

    // Initialize stats for all players in the game
    game.all_player_ids.forEach(playerId => {
        statsSummary.set(playerId.toString(), {
            pts: 0, fga: 0, fgm: 0, '3pa': 0, '3pm': 0, fta: 0, ftm: 0,
            reb: 0, oreb: 0, dreb: 0, ast: 0, tov: 0, stl: 0, blk: 0, pf: 0,
            // We'll calculate plus_minus, dd2, td3 later if needed, more complex
        });
    });

    // Iterate through events to tally stats
    game.events.forEach(event => {
        const playerIdStr = event.player_id.toString();
        const playerStats = statsSummary.get(playerIdStr);

        if (!playerStats) return; // Should not happen if initialized correctly

        switch (event.type) {
            case 'shot':
                playerStats.fga += 1;
                if (event.points === 3) playerStats['3pa'] += 1;
                if (event.made) {
                    playerStats.fgm += 1;
                    playerStats.pts += event.points;
                    if (event.points === 3) playerStats['3pm'] += 1;
                }
                break;
            case 'free_throw': // Assuming free throws might be logged separately
                 playerStats.fta += 1;
                 if (event.made) {
                     playerStats.ftm += 1;
                     playerStats.pts += 1; // FTs are 1 point
                 }
                 break;
            case 'rebound':
                playerStats.reb += 1;
                if (event.rebound_type === 'offensive') playerStats.oreb += 1;
                else playerStats.dreb += 1;
                break;
            case 'turnover':
                playerStats.tov += 1;
                break;
            case 'steal':
                playerStats.stl += 1;
                break;
            case 'block':
                playerStats.blk += 1;
                break;
            case 'foul':
                playerStats.pf += 1;
                break;
            // Add case for 'assist' if you log assists directly
            // Note: Calculating assists often requires linking a made shot to a previous pass,
            // which adds complexity to the event logging or post-processing.
            default:
                break;
        }
        statsSummary.set(playerIdStr, playerStats);
    });

    // Calculate DD2/TD3 flags (Simplified example)
    statsSummary.forEach((stats, playerId) => {
        let count10 = 0;
        if (stats.pts >= 10) count10++;
        if (stats.reb >= 10) count10++;
        if (stats.ast >= 10) count10++; // Assuming assists are tracked
        if (stats.stl >= 10) count10++; // Less common
        if (stats.blk >= 10) count10++; // Less common

        if (count10 >= 3) {
            stats.is_triple_double = true;
            stats.is_double_double = true; // TD is also DD
        } else if (count10 >= 2) {
        stats.is_double_double = true;
        }
            statsSummary.set(playerId, stats);
    });


    return statsSummary;
};

// --- Internal Helper: Update Player Overall Stats ---
const _internalUpdatePlayerStats = async (game) => {
    let playerUpdatePromises = [];
    const shotsByPlayer = {};

    game.events.forEach(event => {
        if (event.type === 'shot') {
            const playerIdStr = event.player_id.toString();
            if (!shotsByPlayer[playerIdStr]) {
                shotsByPlayer[playerIdStr] = [];
            }
            // Format shot data as needed for player schema's all_time_shot_data
            shotsByPlayer[playerIdStr].push({
                x: event.location?.x, // Use optional chaining just in case
                y: event.location?.y,
                made: event.made,
                points: event.points,
                game_id: game._id, // Add the game ID reference
                timestamp: event.timestamp // Use the event's timestamp
            });
        }
    });
    // <<< END ADDED SECTION >>>

    // Now the rest of your function can use shotsByPlayer and playerUpdatePromises
    game.game_stats_summary.forEach((stats, playerIdStr) => {
        // --- Determine Win/Loss/Neither based on game status ---
        // (Your existing win/loss logic here...)
        let winIncrement = 0;
        let lossIncrement = 0;
        // ... (rest of win/loss logic) ...

        const updateData = {
            $inc: {
                'overall_stats.games_played': 1,
                'overall_stats.wins': winIncrement,
                'overall_stats.losses': lossIncrement,
                // Double-check ALL these field names against BOTH schemas
                'overall_stats.total_points': stats.pts || 0,
                'overall_stats.total_fga': stats.fga || 0,
                'overall_stats.total_fgm': stats.fgm || 0, // Ensure fgm is calculated correctly in _internalCalculateStats
                'overall_stats.total_3pa': stats['3pa'] || 0, // Correctly access '3pa'
                'overall_stats.total_3pm': stats['3pm'] || 0, // Correctly access '3pm'
                // --- ADD MISSING FIELDS ---
                'overall_stats.total_2pa': (stats.fga || 0) - (stats['3pa'] || 0), // Calculate 2PA if not stored
                'overall_stats.total_2pm': (stats.fgm || 0) - (stats['3pm'] || 0), // Calculate 2PM if not stored
                // --- END ADD MISSING ---
                'overall_stats.total_fta': stats.fta || 0,
                'overall_stats.total_ftm': stats.ftm || 0,
                'overall_stats.total_rebounds': stats.reb || 0,
                'overall_stats.total_oreb': stats.oreb || 0,
                'overall_stats.total_dreb': stats.dreb || 0,
                'overall_stats.total_assists': stats.ast || 0,
                'overall_stats.total_turnovers': stats.tov || 0,
                'overall_stats.total_steals': stats.stl || 0,
                'overall_stats.total_blocks': stats.blk || 0,
                'overall_stats.total_fouls': stats.pf || 0,
                // 'overall_stats.total_plus_minus': stats.plus_minus || 0, // Plus/minus might need different calculation
                'overall_stats.total_double_doubles': stats.is_double_double ? 1 : 0,
                'overall_stats.total_triple_doubles': stats.is_triple_double ? 1 : 0,
            }
        };

        // Add shot data using the prepared shotsByPlayer object
        if (shotsByPlayer[playerIdStr] && shotsByPlayer[playerIdStr].length > 0) {
            updateData.$push = {
                all_time_shot_data: { $each: shotsByPlayer[playerIdStr] }
            };
        }

        // Add the update promise to the array
        playerUpdatePromises.push(
            Player.findByIdAndUpdate(playerIdStr, updateData)
        );
    });

    try {
        await Promise.all(playerUpdatePromises); // Execute all updates concurrently
        console.log(`Successfully updated overall stats for players in game ${game._id} (Status: ${game.status})`);
    } catch (error) {
        console.error(`Error updating player stats for game ${game._id}:`, error);
        // Consider how to handle partial failures (e.g., logging which player updates failed)
    }
};

// Inside _internalFinalizeGame helper function
const _internalFinalizeGame = async (gameId) => {
    try {
        const game = await Game.findById(gameId);

        // --- <<< ADD THIS CHECK >>> ---
        if (!game) {
            console.error(`Finalize Error: Game ${gameId} not found.`);
            return null; // Indicate failure: game not found
        }
        if (game.status !== 'in_progress') {
            console.warn(`Finalize Warning: Game ${gameId} is already '${game.status}'. Cannot finalize again.`);
            return null; // Indicate failure: game not in progress
        }
        // --- End Check ---

        // Determine winner based on current score
        if (game.final_score.team_a > game.final_score.team_b) {
            game.winner = 'team_a';
        } else if (game.final_score.team_b > game.final_score.team_a) {
            game.winner = 'team_b';
        } else {
            game.winner = null; // Handle ties
        }

        game.status = 'finished'; // Set status
        game.game_stats_summary = _internalCalculateStats(game); // Calculate stats
        const finalizedGame = await game.save(); // Save game state

        // Trigger player stat updates (run asynchronously is okay here)
        _internalUpdatePlayerStats(finalizedGame).catch(err => {
             console.error(`Background player stat update failed for finalized game ${gameId}:`, err);
         });

        return finalizedGame; // Return the updated game doc
     } catch (error) {
        console.error(`Error during internal finalization for game ${gameId}:`, error);
        throw error; // Rethrow to be caught by the main finalizeGame handler
    }
};

// --- APIs ---
const createGame = async (request, response) => {
    const created_by = request.user._id;
    const { game_type, team_a, team_b, score_to_win } = request.body;

    // --- Basic Validation ---
    if (!game_type || !team_a || !team_b || team_a.length === 0 || team_b.length === 0) {
        // Removed score_to_win check from here based on previous discussion
        return response.status(400).json({ message: 'Missing required game creation fields (game_type, team_a, team_b)' });
    }

    const allIds = [...team_a, ...team_b];
    const uniqueIds = [...new Set(allIds)]; // Get unique IDs

    // --- Validate ID Format ---
    for (const id of uniqueIds) {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return response.status(400).json({ message: `Invalid player ID format: ${id}` });
        }
    }

    try {
        // --- <<< ADD THIS CHECK: Check if all player IDs exist >>> ---
        const foundPlayers = await Player.find({ '_id': { $in: uniqueIds } }).select('_id'); // Find players whose IDs are in the list

        if (foundPlayers.length !== uniqueIds.length) {
            // If the number of found players doesn't match the number of unique IDs provided...
            const foundIds = foundPlayers.map(p => p._id.toString());
            const missingIds = uniqueIds.filter(id => !foundIds.includes(id));
            return response.status(404).json({
                 message: 'One or more player IDs were not found',
                 missing_ids: missingIds // Tell the frontend which IDs are invalid
             });
        }
        // --- End Existence Check ---

        // If all checks pass, proceed to create the game
        const newGame = new Game({
            created_by,
            game_type,
            all_player_ids: uniqueIds, // Use the validated unique IDs
            teams: { team_a, team_b },
            score_to_win, // Optional score_to_win
            status: 'in_progress',
        });

        const savedGame = await newGame.save();
        response.status(201).json(savedGame);

    } catch (error) {
        console.error("Game Creation Error:", error);
        response.status(500).json({ message: 'Server error during game creation' });
    }
};

const addGameEvent = async (request, response) => {
    const { id: gameId } = request.params;
    const eventData = request.body;

    // Basic event data validation (add more robust validation)
    if (!eventData.type || !eventData.player_id || !eventData.team) {
        return response.status(400).json({ message: 'Event data requires type, player_id, and team' });
    }

    if (!mongoose.Types.ObjectId.isValid(gameId)) {
        return response.status(400).json({ message: 'Invalid game ID format' });
    }

    try {
        const game = await Game.findById(gameId);

        if (!game) {
            return response.status(404).json({ message: 'Game not found' });
        }

        if (game.status !== 'in_progress') {
            return response.status(400).json({ message: `Cannot add event, game status is '${game.status}'` });
        }

        // Add timestamp if not provided by client (usually better to let server do it)
        eventData.timestamp = new Date();

        // Push event
        game.events.push(eventData);

        // Update score if it was a made shot/FT
        if ((eventData.type === 'shot' || eventData.type === 'free_throw') && eventData.made) {
            const points = eventData.points || (eventData.type === 'free_throw' ? 1 : 0); // Default FT to 1 point
            if (eventData.team === 'team_a') {
                game.final_score.team_a += points;
            } else if (eventData.team === 'team_b') {
                game.final_score.team_b += points;
            }
        }

        // --- Check for Win Condition ---

        /*
        let finalizedGame = null;
        if (game.final_score.team_a >= game.score_to_win || game.final_score.team_b >= game.score_to_win) {
            console.log(`Game ${gameId} win condition met. Finalizing...`);
            // Don't await this if you want to send response faster, but awaiting ensures
            // the game document you send back *is* the finalized one.
            finalizedGame = await _internalFinalizeGame(gameId);
            if (!finalizedGame) {
                // Finalization failed internally, likely already finished/canceled
                // Might need to refetch the game to send current state
                const currentGame = await Game.findById(gameId);
                return response.status(200).json({ message: 'Event added, but game was likely already finalized.', game: currentGame });
            }
        } else {
            // Save game with new event and potentially updated score if not finished
            await game.save();
        }
        */

        await game.save();

        // Respond with the updated game (either just saved or fully finalized)
        response.status(200).json({
            message: 'Event added successfully',
            game: game // Send back the updated game document
        });


    } catch (error) {
        console.error("Game Event Error:", error);
        response.status(500).json({ message: 'Server error during game event processing' });
    }
};

const getGameById = async (request, response) => {
    const { id } = request.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return response.status(400).json({ message: 'Invalid game ID format' });
    }

    try {
        // Populate player names/handles for easier display on frontend
        const game = await Game.findById(id)
            .populate('all_player_ids', 'name instagram_handle') // Populate names for all players
            .populate('created_by', 'email'); // Populate admin email

        if (!game) {
            return response.status(404).json({ message: 'Game not found' });
        }

        response.status(200).json(game);

    } catch (error) {
        console.error("Game Retrieval Error:", error);
        response.status(500).json({ message: 'Server error during game retrieval by id' });
    }
};

const finalizeGame = async (request, response) => {
    const { id: gameId } = request.params;

     if (!mongoose.Types.ObjectId.isValid(gameId)) {
        return response.status(400).json({ message: 'Invalid game ID format' });
    }

    try {
        // Use the internal helper function
        const finalizedGame = await _internalFinalizeGame(gameId);

        if (!finalizedGame) {
        // Could mean game not found, or already finished/canceled
        const game = await Game.findById(gameId); // Check current state
        if (!game) return response.status(404).json({ message: 'Game not found' });
        return response.status(400).json({ message: `Game cannot be finalized, status is already '${game.status}'`});
        }

        response.status(200).json({ message: 'Game finalized successfully', game: finalizedGame });

    } catch (error) {
        // Errors from _internalFinalizeGame will be caught here
        console.error("Game Finalization Error:", error);
        response.status(500).json({ message: 'Server error during finalizing game' });
    }
};

const cancelGame = async (request, response) => {
    const { id: gameId } = request.params;

    if (!mongoose.Types.ObjectId.isValid(gameId)) {
        return response.status(400).json({ message: 'Invalid game ID format' });
    }

    try {
        const game = await Game.findById(gameId);

        if (!game) {
            return response.status(404).json({ message: 'Game not found' });
        }

        if (game.status !== 'in_progress') {
            return response.status(400).json({ message: `Game cannot be canceled, status is already '${game.status}'` });
        }

        game.status = 'canceled'; // Set status to canceled
        game.winner = null; // Ensure winner is null

        // --- Process stats up to cancellation ---
        game.game_stats_summary = _internalCalculateStats(game); // Calculate partial stats

        // Save the game document first (with status & summary)
        const canceledGame = await game.save();

        // --- Update player overall stats based on partial game ---
        // Run this asynchronously in the background
        _internalUpdatePlayerStats(canceledGame).catch(err => {
             console.error(`Background player stat update failed for canceled game ${gameId}:`, err);
             // Log error for monitoring
         });

        response.status(200).json({ message: 'Game canceled successfully, partial stats recorded.', game: canceledGame });

    } catch (error) {
        console.error("Game Cancellation Error:", error);
        response.status(500).json({ message: 'Server error during canceling game' });
    }
};

module.exports = {
    createGame,
    addGameEvent,
    getGameById,
    finalizeGame,
    cancelGame
};
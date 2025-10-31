const Player = require('./model');
const Game = require('../game/model');
const mongoose = require('mongoose');

const createPlayer = async (request, response) => {
    // Assumes protect middleware ran and attached request.user
    const created_by = request.user._id;

    // Extract player details from request body
    const {
        name,
        instagram_handle,
        profile_image_url,
        bio,
        height_inches,
        weight_lbs,
        position,
        date_of_birth,
        city,
        state
    } = request.body;

    // Basic validation (add more robust validation later, e.g., express-validator)
    if (!name) {
        return response.status(400).json({ message: 'Player name is required' });
    }

    try {
        // Create new player object
        const newPlayer = new Player({
            created_by,
            name,
            instagram_handle,
            profile_image_url,
            bio,
            height_inches,
            weight_lbs,
            position,
            date_of_birth,
            city,
            state
            // overall_stats will and all_time_shot_data will start as an empty array
        });

        // Save the player to the database
        const savedPlayer = await newPlayer.save();

        // Send back the created player data
        response.status(201).json(savedPlayer);

    } catch (error) {
        console.error("Player Creation Error:", error);
        // Handle potential duplicate key errors if unique constraints are added (like unique IG handle)
        if (error.code === 11000) {
            return response.status(400).json({ message: 'Error creating player: A player with that value already exists.' });
        }
        response.status(500).json({ message: 'Server error during player creation' });
    }
};

const updatePlayer = async (request, response) => {
    // params comes from the /:id
    const { id } = request.params;
    // body comes from frontend
    const updates = request.body; // Contains fields to update

    // Validate if the ID is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return response.status(400).json({ message: 'Invalid player ID format' });
    }

    // Prevent updating protected fields like stats directly via this route
    delete updates.overall_stats;
    delete updates.all_time_shot_data;
    delete updates.created_by;

    try {
        const updatedPlayer = await Player.findByIdAndUpdate(id, updates, { new: true, runValidators: true });

        if (!updatedPlayer) {
            return response.status(404).json({ message: 'Player not found' });
        }

        response.status(200).json(updatedPlayer);

    } catch (error) {
        console.error("Player Update Error: ", error);
        response.status(500).json({ message: 'Server error during player update'});
    }
};

const deletePlayer = async (request, response) => {
    const { id } = request.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return response.status(404).json({ message: 'Player not found'});
    }

    try {
        const deletePlayer = await Player.findByIdAndDelete(id);

        if (!deletePlayer) {
            return response.status(404).json({ message: 'Player not found'});
        }

        return response.status(200).json({ message: 'Player Deleted'});
    } catch (error) {
        console.error("Player Deletion Error: ", error);
        response.status(500).json({ message: 'Server error during player deletion'});
    }
}

const searchPlayers = async (request, response) => {
    const searchTerm = request.query.search;

    if (!searchTerm) {
        return response.status(400).json({ message: 'Search term is required' });
    }

    try {
        const regex = new RegExp(searchTerm, 'i');

        const players = await Player.find({
            $or: [
                { name: regex },
                { instagram_handle: regex }
            ]
        })
        .select('_id name instagram_handle profile_image_url position height_inches weight_lbs')
        .limit(20); // Limit results to prevent overwhelming response

        response.status(200).json(players);

    } catch (error) {
        console.error("Player Search Error:", error);
        response.status(500).json({ message: 'Server error during player search' });
    }
};

const getPlayerById = async (request, response) => {
    const { id } = request.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return response.status(400).json({ message: 'Invalid player ID format' });
    }

    try {
        const player = await Player.findById(id);

        if (!player) {
            return response.status(404).json({ message: 'Player not found' });
        }

        response.status(200).json(player); // Return the full player document

    } catch (error) {
        console.error("Player Retrieval Error:", error);
        response.status(500).json({ message: 'Server error during player retrieval by ID' });
    }
};

const getPlayerRecentGames = async (request, response) => {
    const { id } = request.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return response.status(400).json({ message: 'Invalid player ID format' });
    }

    try {
        const games = await Game.find({ all_player_ids: id })
            .sort({ createdAt: -1 }) // Sort by creation date, newest first
            .limit(10)
            .select('_id game_type status final_score teams winner createdAt');

        response.status(200).json(games);

    } catch (error) {
        console.error("Recent Game Retrieval Error:", error);
        response.status(500).json({ message: 'Server error during player games retrieval' });
    }
};

module.exports = {
    createPlayer,
    updatePlayer,
    deletePlayer,
    searchPlayers,
    getPlayerById,
    getPlayerRecentGames
};
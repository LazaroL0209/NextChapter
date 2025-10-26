// Dependencies
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

// Require Routes/API Endpoints
const gameRouter = require('./routes/game');
const playerRouter = require('./routes/player');
const userRouter = require('./routes/user');

// App Initialization
const app = express();
const port = process.env.PORT;

// DB Connection
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Successfully connected to MongoDB Atlas!'))
    .catch(error => console.error('Error connecting to MongoDB Atlas:', error));

// Middleware
app.use(cors());
app.use(express.json());

// Connecting Route Logic
app.use('/game', gameRouter);
app.use('/player', playerRouter);
app.use('/user', userRouter);

// Begin Listening
app.listen(port, () => {
    console.log(`Connected to port ${port}`)
});

// Export App
module.exports = app;
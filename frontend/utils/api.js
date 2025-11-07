/**
 TO USE:
 * 1. Include this file in your HTML:
 * <script src="/utils/api.js"></script>
 *
 * 2. In your other JS files, you can now call functions like:
 * await apiClient.login('admin@test.com', 'password123');
 * const players = await apiClient.searchPlayers('jordan');
 * const newPlayer = await apiClient.createPlayer({ name: 'New Player' });
 */

(function(window) {
  'use strict';

  const API_BASE_URL = 'https://the-next-chapter-backend.onrender.com/';

  // -----------------------------------------------------------------
  // 2. CORE HELPER FUNCTIONS
  // -----------------------------------------------------------------

  /**
   * A private helper function to handle all protected API requests.
   * It automatically gets the token from localStorage and adds it
   * to the Authorization header.
   *
   * @param {string} endpoint - The API endpoint (e.g., '/api/players')
   * @param {string} method - The HTTP method (e.g., 'POST', 'PATCH')
   * @param {object} [body] - The JSON data to send (optional)
   * @returns {Promise<object>} The JSON response from the server
   */
  async function _fetchWithToken(endpoint, method = 'GET', body = null) {
    const token = localStorage.getItem('authToken');

    if (!token) {
      console.error('No auth token found. Redirecting to login.');
      // If you have a login page, uncomment this to auto-redirect
      // window.location.href = '/login.html'; 
      throw new Error('No auth token found. Please log in.');
    }

    const options = {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
      const data = await response.json();

      if (!response.ok) {
        // If server returns an error (4xx, 5xx), throw it
        throw new Error(data.message || `Error: ${response.status}`);
      }

      return data; // Success
    } catch (error) {
      console.error(`API Error (${method} ${endpoint}):`, error);
      throw error; // Re-throw the error for the page to handle
    }
  }

  /**
   * A private helper for public (non-auth) GET requests.
   */
  async function _fetchPublic(endpoint) {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `Error: ${response.status}`);
      }
      return data; // Success
    } catch (error) {
      console.error(`API Error (GET ${endpoint}):`, error);
      throw error;
    }
  }

  const apiClient = {};

  /**
   * Logs in a user.
   * @param {string} email
   * @param {string} password
   * @returns {Promise<object>} { message, token, user }
   */
  apiClient.login = async function(email, password) {
    // This is the only request that *doesn't* use the helper
    const response = await fetch(`${API_BASE_URL}/api/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Login failed');
    }

    // Save token and user to localStorage
    localStorage.setItem('authToken', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));

    return data;
  };

  /**
   * Logs out the current user.
   */
  apiClient.logout = function() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    // Redirect to login page
    window.location.href = '/login.html';
    console.log('Logged out');
  };

  /**
   * Gets the stored user data.
   * @returns {object|null} The user object or null
   */
  apiClient.getUser = function() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  };

  /**
   * Gets the stored auth token.
   * @returns {string|null} The JWT
   */
  apiClient.getToken = function() {
    return localStorage.getItem('authToken');
  };


  // =============================================================
  // PLAYERS API
  // (Mounted at /api/players)
  // =============================================================

  /**
   * Creates a new player (Admin only).
   * @param {object} playerData - { name, instagram_handle, bio, ... }
   * @returns {Promise<object>} The new player object
   */
  apiClient.createPlayer = async function(playerData) {
    return _fetchWithToken('/api/players', 'POST', playerData);
  };

  /**
   * Updates an existing player (Admin only).
   * @param {string} playerId
   * @param {object} updates - { name, bio, ... }
   * @returns {Promise<object>} The updated player object
   */
  apiClient.updatePlayer = async function(playerId, updates) {
    return _fetchWithToken(`/api/players/${playerId}`, 'PATCH', updates);
  };

  /**
   * Deletes a player (Admin only).
   * @param {string} playerId
   * @returns {Promise<object>} { message: 'Player Deleted' }
   */
  apiClient.deletePlayer = async function(playerId) {
    return _fetchWithToken(`/api/players/${playerId}`, 'DELETE');
  };

  /**
   * Searches for players (Public).
   * @param {string} searchTerm
   * @returns {Promise<Array>} List of player objects
   */
  apiClient.searchPlayers = async function(searchTerm) {
    return _fetchPublic(`/api/players?search=${encodeURIComponent(searchTerm)}`);
  };

  /**
   * Gets a single player by their ID (Public).
   * @param {string} playerId
   * @returns {Promise<object>} The full player object
   */
  apiClient.getPlayerById = async function(playerId) {
    return _fetchPublic(`/api/players/${playerId}`);
  };

  /**
   * Gets recent games for a single player (Public).
   * @param {string} playerId
   * @returns {Promise<Array>} List of game objects
   */
  apiClient.getPlayerRecentGames = async function(playerId) {
    return _fetchPublic(`/api/players/${playerId}/games`);
  };


  // =============================================================
  // GAMES API
  // (Mounted at /api/games)
  // =============================================================

  /**
   * Creates a new game (Admin only).
   * @param {object} gameData - { game_type, team_a, team_b, score_to_win }
   * @returns {Promise<object>} The new game object
   */
  apiClient.createGame = async function(gameData) {
    return _fetchWithToken('/api/games', 'POST', gameData);
  };

  /**
   * Updates a game's general info (Admin only).
   * @param {string} gameId
   * @param {object} updates - { score_to_win, ... }
   * @returns {Promise<object>} The updated game object
   */
  apiClient.updateGame = async function(gameId, updates) {
    return _fetchWithToken(`/api/games/${gameId}`, 'PATCH', updates);
  };

  /**
   * Adds a game event (shot, rebound, etc.) to a game (Admin only).
   * @param {string} gameId
   * @param {object} eventData - { type, player_id, team, ... }
   * @returns {Promise<object>} { message, game }
   */
  apiClient.addGameEvent = async function(gameId, eventData) {
    return _fetchWithToken(`/api/games/${gameId}/event`, 'POST', eventData);
  };

  /**
   * Manually finalizes a game (Admin only).
   * @param {string} gameId
   * @returns {Promise<object>} { message, game }
   */
  apiClient.finalizeGame = async function(gameId) {
    return _fetchWithToken(`/api/games/${gameId}/finish`, 'PATCH');
  };

  /**
   * Cancels an in-progress game (Admin only).
   * @param {string} gameId
   * @returns {Promise<object>} { message, game }
   */
  apiClient.cancelGame = async function(gameId) {
    return _fetchWithToken(`/api/games/${gameId}/cancel`, 'PATCH');
  };

  /**
   * Gets a single game by its ID (Public).
   * @param {string} gameId
   * @returns {Promise<object>} The full game object
   */
  apiClient.getGameById = async function(gameId) {
    return _fetchPublic(`/api/games/${gameId}`);
  };


  // Attach the 'apiClient' object to the global 'window'
  window.apiClient = apiClient;

})(window); // Immediately invoke the function, passing in the 'window' object
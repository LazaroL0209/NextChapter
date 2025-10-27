const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('./model');

const login = async (request, response) => {
    const { email, password } = request.body;

    try {
        // If either field is blank
        if (!email || !password) {
            return response.status(400).json({ message: 'Email and password are required' });
        }

        // Look for user bsaed on email
        const user = await User.findOne({ email: email.toLowerCase() });

        // Check if User Exists
        if (!user) {
            return response.status(401).json({ message: 'Invalid Email' });
        }

        // Compare hash to input
        const isMatch = await bcrypt.compare(password, user.hashed_password);

        // If they do not match
        if (!isMatch) {
            return response.status(401).json({ message: 'Invalid credentials' });
        }

        const payload = {
            userId: user._id, // Standard payload field
            role: user.role   // Include role for authorization checks later
        };

        const secret = process.env.JWT_SECRET;
        if (!secret) {
            console.error("FATAL ERROR: JWT_SECRET is not defined in .env file");
            return response.status(500).json({ message: "Server configuration error, cannot issue token" });
        }

        const options = {
            expiresIn: '90d' // Token expires in 90 days
        };

        const token = jwt.sign(payload, secret, options);

        // Send the token back to the client. The client will need to store this.
        response.status(200).json({
            message: 'Login successful',
            token: token,
            user: {
                id: user._id,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        console.error("Login Error:", error);
        response.status(500).json({ message: 'Server error during login' });
    }
}

module.exports = {
    login
};
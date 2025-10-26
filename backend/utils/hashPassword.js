const bcrypt = require('bcryptjs');

const plainPassword = 'fedou1999'; // The password the user will type

// --- Generate the hash ---
bcrypt.hash(plainPassword, 10, (err, hash) => {
    if (err) {
        console.error('Error hashing password:', err);
        return;
    }
    console.log('Plain Password:', plainPassword);
    console.log('Hashed Password:', hash); // save hash manually in DB
});
const mongoose = require('mongoose');
const User = require('./models/User');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const uri = process.env.MONGODB_URI;

mongoose.connect(uri)
    .then(async () => {
        console.log('✅ Connected');

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('admin123', salt);

        await User.updateOne(
            { username: 's_admin' },
            {
                username: 's_admin',
                password: hashedPassword,
                role: 'super_admin',
                organization: null
            },
            { upsert: true }
        );
        console.log('✅ Super Admin (s_admin) fixed with password: admin123');
        process.exit(0);
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });

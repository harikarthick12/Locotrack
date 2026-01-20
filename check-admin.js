require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/locotrack')
    .then(async () => {
        const admin = await User.findOne({ role: 'super_admin' });
        console.log('Super Admin:', admin);
        process.exit(0);
    })
    .catch(e => {
        console.error(e);
        process.exit(1);
    });

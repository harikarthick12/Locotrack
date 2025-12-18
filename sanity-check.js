const mongoose = require('mongoose');
const User = require('./models/User');
const Organization = require('./models/Organization');
require('dotenv').config();

const uri = process.env.MONGODB_URI;

mongoose.connect(uri)
    .then(async () => {
        console.log('✅ Connected to MongoDB');

        try {
            // Find an org or create a temp one
            let org = await Organization.findOne();
            if (!org) {
                org = new Organization({ name: 'Temp Org', code: 'TEMP' });
                await org.save();
            }

            const username = 'test_admin_' + Date.now();
            console.log(`Attempting to create user: ${username}`);

            const admin = new User({
                username: username,
                password: 'test_password',
                role: 'admin',
                organization: org._id
            });

            await admin.save();
            console.log('✅ User saved successfully!');

            // Clean up
            await User.deleteOne({ username });
            process.exit(0);
        } catch (e) {
            console.error('❌ Error during user save:', e.message);
            process.exit(1);
        }
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });

require('dotenv').config();
const mongoose = require('mongoose');
const Bus = require('./models/Bus');
const User = require('./models/User');
const Organization = require('./models/Organization');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/locotrack';

mongoose.connect(MONGODB_URI)
    .then(async () => {
        console.log('✅ Connected to MongoDB');

        // Delete all buses
        const buses = await Bus.deleteMany({});
        console.log(`🗑️  Deleted ${buses.deletedCount} buses`);

        // Delete all organizations
        const orgs = await Organization.deleteMany({});
        console.log(`🗑️  Deleted ${orgs.deletedCount} organizations`);

        // Delete all users EXCEPT super_admin
        const users = await User.deleteMany({ role: { $ne: 'super_admin' } });
        console.log(`🗑️  Deleted ${users.deletedCount} users (kept Super Admin)`);

        console.log('✅ Database cleaned successfully. No artifacts remain.');
        process.exit(0);
    })
    .catch(err => {
        console.error('❌ Error:', err);
        process.exit(1);
    });

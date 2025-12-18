const mongoose = require('mongoose');
const User = require('./models/User');
const Organization = require('./models/Organization');
require('dotenv').config();

const uri = process.env.MONGODB_URI;

mongoose.connect(uri)
    .then(async () => {
        console.log('✅ Connected to MongoDB');

        // Find existing organizations
        const dsu = await Organization.findOne({ code: 'DSU' });
        const krcet = await Organization.findOne({ code: 'KRCET' });

        if (dsu) {
            console.log('Fixing DSU Admin...');
            await User.deleteMany({ username: 'dsu_admin' }); // Clear old if any
            const admin = new User({
                username: 'dsu_admin',
                password: 'dsu_password', // Replace with your desired password or use this for now
                role: 'admin',
                organization: dsu._id
            });
            await admin.save();
            console.log('✅ DSU Admin created: dsu_admin / dsu_password');
        }

        if (krcet) {
            console.log('Fixing KRCET Admin...');
            await User.deleteMany({ username: 'krcet_admin' }); // Clear old if any
            const admin = new User({
                username: 'krcet_admin',
                password: 'krcet_password', // Replace with your desired password or use this for now
                role: 'admin',
                organization: krcet._id
            });
            await admin.save();
            console.log('✅ KRCET Admin created: krcet_admin / krcet_password');
        }

        console.log('\n--- Final Check ---');
        const admins = await User.find({ role: 'admin' }).populate('organization');
        admins.forEach(a => console.log(`Admin: ${a.username} | College: ${a.organization?.name}`));

        process.exit(0);
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });

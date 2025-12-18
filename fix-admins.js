const mongoose = require('mongoose');
const User = require('./models/User');
const Organization = require('./models/Organization');
require('dotenv').config();

const uri = process.env.MONGODB_URI;

mongoose.connect(uri)
    .then(async () => {
        console.log('✅ Connected');

        // 1. Get Orgs
        const dsu = await Organization.findOne({ code: 'DSU' });
        const krcet = await Organization.findOne({ code: 'KRCET' });

        if (!dsu || !krcet) {
            console.log('❌ Orgs not found. Run Super Admin setup first.');
            process.exit(1);
        }

        console.log(`DSU ID: ${dsu._id}`);
        console.log(`KRCET ID: ${krcet._id}`);

        // 2. Create/Update DSU Admin
        const dsuAdmin = await User.findOneAndUpdate(
            { username: 'dsu_admin' },
            {
                username: 'dsu_admin',
                password: 'dsu123', // Will be hashed by save() if we used save, but findOneAndUpdate doesn't trigger hooks!
                role: 'admin',
                organization: dsu._id
            },
            { upsert: true, new: true }
        );
        // Manually hash password since findOneAndUpdate bypasses hooks
        dsuAdmin.password = 'dsu123';
        await dsuAdmin.save(); // save() triggers hook and hashing
        console.log('✅ Created dsu_admin');

        // 3. Create/Update KRCET Admin
        const krcetAdmin = await User.findOneAndUpdate(
            { username: 'krcet_admin' },
            {
                username: 'krcet_admin',
                password: 'krcet123',
                role: 'admin',
                organization: krcet._id
            },
            { upsert: true, new: true }
        );
        krcetAdmin.password = 'krcet123';
        await krcetAdmin.save();
        console.log('✅ Created krcet_admin');

        // 4. Update vk18 to belong to DSU (optional)
        const vk18 = await User.findOne({ username: 'vk18' });
        if (vk18) {
            vk18.organization = dsu._id;
            vk18.role = 'admin'; // Ensure it's admin, not super_admin if we want to use it here
            await vk18.save();
            console.log('✅ Updated vk18 to belong to DSU');
        }

        process.exit(0);
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });

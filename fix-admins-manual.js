const mongoose = require('mongoose');
const User = require('./models/User');
const Organization = require('./models/Organization');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const uri = process.env.MONGODB_URI;

mongoose.connect(uri)
    .then(async () => {
        console.log('✅ Connected');

        // 1. Get Orgs
        const dsu = await Organization.findOne({ code: 'DSU' });
        const krcet = await Organization.findOne({ code: 'KRCET' });

        if (!dsu || !krcet) {
            console.log('❌ Orgs not found.');
            process.exit(1);
        }

        // Helper to Create/Update Admin safely
        const createAdmin = async (username, password, orgId) => {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            await User.updateOne(
                { username },
                {
                    username,
                    password: hashedPassword,
                    role: 'admin',
                    organization: orgId
                },
                { upsert: true }
            );
            console.log(`✅ Fixed/Created: ${username}`);
        };

        await createAdmin('dsu_admin', 'dsu123', dsu._id);
        await createAdmin('krcet_admin', 'krcet123', krcet._id);
        await createAdmin('vk18', 'vk18', dsu._id); // Assign vk18 to DSU too

        process.exit(0);
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });

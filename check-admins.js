const mongoose = require('mongoose');
const User = require('./models/User');
const Organization = require('./models/Organization');
require('dotenv').config();

const uri = process.env.MONGODB_URI;

mongoose.connect(uri)
    .then(async () => {
        console.log('✅ Connected to MongoDB\n');

        // 1. List Organizations
        const orgs = await Organization.find();
        console.log('--- REGISTERED COLLEGES ---');
        if (orgs.length === 0) console.log('❌ No colleges assigned.');
        orgs.forEach(o => {
            console.log(`Code: [${o.code}] | Name: ${o.name} | ID: ${o._id}`);
        });

        // 2. List Admins
        const admins = await User.find({ role: 'admin' }).populate('organization');
        console.log('\n--- ADMIN ACCOUNTS ---');
        if (admins.length === 0) console.log('❌ No admin accounts found.');

        admins.forEach(u => {
            console.log(`Username: ${u.username}`);
            console.log(`   - Role: ${u.role}`);
            console.log(`   - Org: ${u.organization ? u.organization.name + ' (' + u.organization.code + ')' : '❌ UNLINKED'}`);
            console.log(`   - Org ID: ${u.organization ? u.organization._id : 'null'}`);
            console.log(`   - Password Hash: ${u.password.substring(0, 15)}...`);
        });

        process.exit(0);
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });

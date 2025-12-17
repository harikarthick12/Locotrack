const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

const uri = process.env.MONGODB_URI;

mongoose.connect(uri)
    .then(async () => {
        console.log('✅ Connected to MongoDB');

        // 1. Check for any Super Admin
        const superAdmins = await User.find({ role: 'super_admin' });
        console.log('\n🔍 Super Admins found:', superAdmins.length);
        superAdmins.forEach(u => console.log(` - Username: ${u.username}, Role: ${u.role}`));

        // 2. Check vk18 status
        const vk18 = await User.findOne({ username: 'vk18' });
        if (vk18) {
            console.log(`\n🔍 User 'vk18' found: Role = ${vk18.role}`);
        } else {
            console.log("\n❌ User 'vk18' NOT found");
        }

        // 3. FORCE CREATE/UPDATE Super Admin
        // This bypasses the pre-save hook issue by using manual update if needed, 
        // OR uses the model properly now that the hook is fixed.

        console.log('\n🛠️  Attempting to fix Super Admin...');

        // We will create/update 's_admin' with known password
        const bcrypt = require('bcryptjs');
        const salt = await bcrypt.genSalt(10);
        const secPass = await bcrypt.hash('admin123', salt); // Password: admin123

        try {
            await User.findOneAndUpdate(
                { username: 's_admin' },
                {
                    username: 's_admin',
                    password: secPass, // Manually hashed
                    role: 'super_admin',
                    organization: null
                },
                { upsert: true, new: true }
            );
            console.log('✅ SUCCESS: Super Admin created/updated!');
            console.log('👉 Username: s_admin');
            console.log('👉 Password: admin123');
        } catch (e) {
            console.error('❌ Error fixing super admin:', e);
        }

        process.exit(0);
    })
    .catch(err => {
        console.error('❌ Connection error:', err);
        process.exit(1);
    });

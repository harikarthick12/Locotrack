require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Organization = require('./models/Organization');
const Bus = require('./models/Bus');

async function fixCredentials() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // 1. Reset Super Admin
        const saUsername = 'super admin';
        const saPassword = 'superadmin@locotrack';
        const salt = await bcrypt.genSalt(10);
        const saHash = await bcrypt.hash(saPassword, salt);

        await User.updateOne(
            { role: 'super_admin' },
            {
                $set: {
                    username: saUsername,
                    password: saHash
                }
            },
            { upsert: true }
        );
        console.log(`👑 SUPER ADMIN reset: "${saUsername}" / "${saPassword}"`);

        // 2. Clear out legacy admins if they exist and don't fit new pattern?
        // Actually let's just update all current admins to follow the new password rule
        const admins = await User.find({ role: 'admin' }).populate('organization');
        for (const admin of admins) {
            if (admin.organization) {
                const orgCode = admin.organization.code.toLowerCase();
                const newUsername = orgCode + 'admin';
                const newPassword = orgCode + '@locotrack';
                const adminHash = await bcrypt.hash(newPassword, salt);

                await User.updateOne(
                    { _id: admin._id },
                    {
                        $set: {
                            username: newUsername,
                            password: adminHash
                        }
                    }
                );
                console.log(`🏢 ADMIN reset: "${newUsername}" / "${newPassword}"`);
            }
        }

        // 3. Reset all drivers
        const drivers = await User.find({ role: 'driver' });
        for (const driver of drivers) {
            if (driver.busRegNo) {
                const regNo = driver.busRegNo.toUpperCase();
                const newPassword = regNo + '@locotrack';
                const driverHash = await bcrypt.hash(newPassword, salt);

                await User.updateOne(
                    { _id: driver._id },
                    {
                        $set: {
                            username: regNo,
                            password: driverHash
                        }
                    }
                );
                console.log(`🚌 DRIVER reset: "${regNo}" / "${newPassword}"`);
            }
        }

        console.log('✅ All credentials reset to new pattern!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error during reset:', err);
        process.exit(1);
    }
}

fixCredentials();

const mongoose = require('mongoose');
const User = require('./models/User');
const Organization = require('./models/Organization');
const fs = require('fs');
require('dotenv').config();

const uri = process.env.MONGODB_URI;

mongoose.connect(uri)
    .then(async () => {
        let output = 'DEBUG REPORT:\n';

        const orgs = await Organization.find();
        output += `\n--- ORGANIZATIONS (${orgs.length}) ---\n`;
        orgs.forEach(o => output += `[${o.code}] ${o.name}\n`);

        const admins = await User.find({ role: 'admin' }).populate('organization');
        output += `\n--- COLLEGE ADMINS (${admins.length}) ---\n`;

        admins.forEach(admin => {
            output += `User: ${admin.username} | Org: ${admin.organization?.code} | Hash: ${admin.password.substring(0, 10)}... | IsHashed: ${admin.password.startsWith('$2')}\n`;
        });

        fs.writeFileSync('debug-output.txt', output);
        console.log('Done');
        process.exit(0);
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });

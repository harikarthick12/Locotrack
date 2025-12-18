const mongoose = require('mongoose');
const User = require('./models/User');
const Organization = require('./models/Organization');
const fs = require('fs');
require('dotenv').config();

const uri = process.env.MONGODB_URI;

mongoose.connect(uri)
    .then(async () => {
        let log = '--- DIAGNOSTIC START ---\n';

        const orgs = await Organization.find();
        log += `\nCOLLEGES (${orgs.length}):\n`;
        orgs.forEach(o => {
            log += ` - Code: ${o.code} | ID: ${o._id}\n`;
        });

        const admins = await User.find({ role: 'admin' }).populate('organization');
        log += `\nADMINS (${admins.length}):\n`;
        admins.forEach(a => {
            log += ` - Username: ${a.username} | Org: ${a.organization ? a.organization.code : 'NULL'} | OrgID: ${a.organization ? a.organization._id : 'NULL'}\n`;
        });

        fs.writeFileSync('admin-diagnostic.txt', log);
        console.log('Diagnostic written to admin-diagnostic.txt');
        process.exit(0);
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });

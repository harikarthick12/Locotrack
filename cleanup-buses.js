const mongoose = require('mongoose');
const Bus = require('./models/Bus');
require('dotenv').config();

const uri = process.env.MONGODB_URI;

mongoose.connect(uri)
    .then(async () => {
        console.log('✅ Connected to MongoDB');

        try {
            // 1. Drop the old unique index on busNumber
            // Mongoose might have created 'busNumber_1'
            console.log('Dropping old indexes...');
            await Bus.collection.dropIndex('busNumber_1').catch(err => console.log('Index busNumber_1 not found, skipping.'));

            // 2. Clear all buses to allow a clean restart
            console.log('Cleaning up buses...');
            const result = await Bus.deleteMany({});
            console.log(`✅ Deleted ${result.deletedCount} buses.`);

            console.log('\n--- SUCCESS ---');
            console.log('All ghost buses removed and indexes updated.');
            console.log('You can now add your buses again safely!');

            process.exit(0);
        } catch (e) {
            console.error('❌ Error during cleanup:', e.message);
            process.exit(1);
        }
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });

const mongoose = require('mongoose');

const organizationSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    code: {
        type: String, // e.g., "DSU", "KRCET"
        required: true,
        unique: true,
        uppercase: true,
        trim: true
    },
    address: {
        type: String,
        default: ''
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Organization', organizationSchema);

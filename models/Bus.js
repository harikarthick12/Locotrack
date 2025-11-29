const mongoose = require('mongoose');

const busSchema = new mongoose.Schema({
    regNo: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true
    },
    route: {
        type: String,
        required: true
    },
    start: {
        type: String,
        default: ''
    },
    destination: {
        type: String,
        default: ''
    },
    stops: [{
        type: String
    }],
    status: {
        type: String,
        enum: ['online', 'offline'],
        default: 'offline'
    },
    lastSeen: {
        type: Date,
        default: null
    },
    currentLocation: {
        lat: Number,
        lng: Number,
        accuracy: Number,
        updatedAt: Date
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Index for faster queries
// busSchema.index({ regNo: 1 }); // Already indexed by unique: true
busSchema.index({ status: 1 });

module.exports = mongoose.model('Bus', busSchema);

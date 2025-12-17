const mongoose = require('mongoose');

const busSchema = new mongoose.Schema({
    regNo: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true
    },
    busNumber: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true,
        // Format: A4, B19, etc.
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
    },
    organization: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true
    }
});

// Index for faster queries
// busSchema.index({ regNo: 1 }); // Already indexed by unique: true
// busSchema.index({ busNumber: 1 }); // Already indexed by unique: true
busSchema.index({ status: 1 });

module.exports = mongoose.model('Bus', busSchema);

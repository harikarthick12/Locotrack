require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const compression = require('compression');
const http = require('http');
const socketIO = require('socket.io');
const cron = require('node-cron');

// Import logger and models
const logger = require('./config/logger');
const Bus = require('./models/Bus');
const User = require('./models/User');
const { authMiddleware, adminOnly } = require('./middleware/auth');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

// Compression middleware
app.use(compression());

// Security Middleware
app.use(helmet({
    contentSecurityPolicy: false // Disable for Leaflet maps
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/locotrack';

logger.info('Attempting to connect to MongoDB...');

mongoose.connect(MONGODB_URI)
    .then(() => {
        logger.info('✅ Connected to MongoDB');
        console.log('✅ Connected to MongoDB');
        initializeAdmin();
    })
    .catch(err => {
        logger.error('❌ MongoDB connection error:', err);
        console.error('❌ MongoDB connection error:', err.message);
        logger.warn('⚠️  Falling back to in-memory storage');
    });

// Initialize default admin user
async function initializeAdmin() {
    try {
        const adminExists = await User.findOne({ username: process.env.ADMIN_USERNAME });
        if (!adminExists) {
            const admin = new User({
                username: process.env.ADMIN_USERNAME || 'vk18',
                password: process.env.ADMIN_PASSWORD || 'vk18',
                role: 'admin'
            });
            await admin.save();
            logger.info('✅ Default admin user created');
        }
    } catch (error) {
        logger.error('Error creating admin user:', error);
    }
}

// In-memory fallback
let busLocations = {};
let registeredBuses = [];

// WebSocket connection handling
io.on('connection', (socket) => {
    logger.debug(`🔌 Client connected: ${socket.id}`);

    // Join room for specific bus tracking
    socket.on('track-bus', (regNo) => {
        socket.join(`bus-${regNo}`);
        logger.debug(`📍 Client ${socket.id} tracking bus ${regNo}`);
    });

    // Stop tracking
    socket.on('stop-tracking', (regNo) => {
        socket.leave(`bus-${regNo}`);
        logger.debug(`🛑 Client ${socket.id} stopped tracking bus ${regNo}`);
    });

    socket.on('disconnect', () => {
        logger.debug(`🔌 Client disconnected: ${socket.id}`);
    });
});

// Broadcast location update to all tracking clients
function broadcastLocationUpdate(regNo, locationData) {
    io.to(`bus-${regNo}`).emit('location-update', {
        regNo,
        ...locationData
    });
}

// Cron job to mark offline buses (runs every 30 seconds)
cron.schedule('*/30 * * * * *', async () => {
    try {
        if (mongoose.connection.readyState === 1) {
            const now = new Date();
            const buses = await Bus.find({ status: 'online' });

            for (const bus of buses) {
                if (bus.lastSeen) {
                    const diff = (now - new Date(bus.lastSeen)) / 1000;
                    if (diff > 15) {
                        bus.status = 'offline';
                        await bus.save();
                        logger.debug(`Bus ${bus.regNo} marked offline (inactive for ${diff}s)`);

                        // Broadcast status change
                        io.emit('bus-status-change', {
                            regNo: bus.regNo,
                            status: 'offline'
                        });
                    }
                }
            }
        }
    } catch (error) {
        logger.error('Cron job error:', error);
    }
});

// Backup job (runs daily at 2 AM)
cron.schedule('0 2 * * *', async () => {
    try {
        if (mongoose.connection.readyState === 1) {
            const buses = await Bus.find({});
            const users = await User.find({}).select('-password');

            const backup = {
                timestamp: new Date(),
                buses,
                users
            };

            const fs = require('fs');
            const backupDir = path.join(__dirname, 'backups');
            if (!fs.existsSync(backupDir)) {
                fs.mkdirSync(backupDir);
            }

            const filename = `backup-${new Date().toISOString().split('T')[0]}.json`;
            fs.writeFileSync(
                path.join(backupDir, filename),
                JSON.stringify(backup, null, 2)
            );

            logger.info(`✅ Database backup created: ${filename}`);
        }
    } catch (error) {
        logger.error('Backup job error:', error);
    }
});

// ==================== ROUTES ====================

// Health Check Endpoint
app.get('/api/health', (req, res) => {
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    const memoryUsage = process.memoryUsage();

    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        database: dbStatus,
        uptime: Math.floor(process.uptime()),
        memory: {
            rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
            heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`
        },
        activeConnections: io.engine.clientsCount
    });
});

// Login Endpoint
app.post('/api/login', async (req, res) => {
    try {
        const { type, username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }

        if (mongoose.connection.readyState === 1) {
            const user = await User.findOne({ username: username.toLowerCase() });

            if (!user) {
                logger.warn(`Login attempt failed: User not found - ${username}`);
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            const isMatch = await user.comparePassword(password);
            if (!isMatch) {
                logger.warn(`Login attempt failed: Wrong password - ${username}`);
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            if (user.role !== type) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            // Temporarily disabled to bypass save hook issue
            // user.lastLogin = new Date();
            // await user.save();

            const token = jwt.sign(
                {
                    userId: user._id,
                    username: user.username,
                    role: user.role,
                    busRegNo: user.busRegNo
                },
                process.env.JWT_SECRET,
                { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
            );

            logger.info(`✅ User logged in: ${username} (${type})`);

            return res.json({
                success: true,
                message: 'Login successful',
                token,
                user: {
                    username: user.username,
                    role: user.role,
                    busRegNo: user.busRegNo
                }
            });
        }

        // Fallback auth
        if (type === 'admin') {
            if (username === 'vk18' && password === 'vk18') {
                const token = jwt.sign({ username, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '7d' });
                return res.json({ success: true, message: 'Admin login successful', token });
            }
        } else if (type === 'driver') {
            const expectedPassword = username + '1818';
            if (password === expectedPassword) {
                const token = jwt.sign({ username, role: 'driver', busRegNo: username }, process.env.JWT_SECRET, { expiresIn: '7d' });
                return res.json({ success: true, message: 'Driver login successful', token });
            }
        }

        res.status(401).json({ error: 'Invalid credentials' });
    } catch (error) {
        logger.error('Login error:', error);
        res.status(500).json({ error: 'Server error during login' });
    }
});

// Update Location (Driver) - Now with WebSocket broadcast
app.post('/api/update-location', async (req, res) => {
    try {
        const { regNo, lat, lng, accuracy } = req.body;

        if (!regNo || !lat || !lng) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const locationData = {
            lat,
            lng,
            accuracy,
            updatedAt: new Date()
        };

        if (mongoose.connection.readyState === 1) {
            const bus = await Bus.findOneAndUpdate(
                { regNo: regNo.toUpperCase() },
                {
                    currentLocation: locationData,
                    status: 'online',
                    lastSeen: new Date()
                },
                { new: true, upsert: false }
            );

            if (bus) {
                // Broadcast to WebSocket clients
                broadcastLocationUpdate(regNo.toUpperCase(), locationData);

                logger.debug(`Location updated for ${regNo}: ${lat}, ${lng}, Acc: ${accuracy}m`);
                return res.json({ success: true, message: 'Location updated' });
            }
        }

        // Fallback
        busLocations[regNo] = { regNo, ...locationData };
        const busIndex = registeredBuses.findIndex(b => b.regNo === regNo);
        if (busIndex !== -1) {
            registeredBuses[busIndex].status = 'online';
            registeredBuses[busIndex].lastSeen = new Date();
        }

        broadcastLocationUpdate(regNo, locationData);
        res.json({ success: true, message: 'Location updated' });
    } catch (error) {
        logger.error('Update location error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get Bus Location
app.get('/api/bus-location/:regNo', async (req, res) => {
    try {
        const { regNo } = req.params;

        if (mongoose.connection.readyState === 1) {
            const bus = await Bus.findOne({ regNo: regNo.toUpperCase() });
            if (bus && bus.currentLocation) {
                return res.json(bus.currentLocation);
            }
        }

        const data = busLocations[regNo];
        if (!data) {
            return res.status(404).json({ error: 'Bus not found or offline' });
        }

        res.json(data);
    } catch (error) {
        logger.error('Get bus location error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get Route Details
app.get('/api/route-details/:regNo', async (req, res) => {
    try {
        const { regNo } = req.params;

        if (mongoose.connection.readyState === 1) {
            const bus = await Bus.findOne({ regNo: regNo.toUpperCase() });
            if (bus) {
                return res.json({
                    regNo: bus.regNo,
                    route: bus.route,
                    start: bus.start || '',
                    destination: bus.destination || '',
                    stops: bus.stops || []
                });
            }
        }

        const bus = registeredBuses.find(b => b.regNo === regNo);
        if (!bus) {
            return res.status(404).json({ error: 'Bus not found' });
        }

        res.json({
            regNo: bus.regNo,
            route: bus.route,
            start: bus.start || '',
            destination: bus.destination || '',
            stops: bus.stops || []
        });
    } catch (error) {
        logger.error('Get route details error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ==================== ADMIN APIs ====================

app.get('/api/admin/buses', async (req, res) => {
    try {
        if (mongoose.connection.readyState === 1) {
            const buses = await Bus.find({}).select('-__v');
            return res.json(buses);
        }

        const now = new Date();
        registeredBuses.forEach(bus => {
            if (bus.status === 'online' && bus.lastSeen) {
                const diff = (now - new Date(bus.lastSeen)) / 1000;
                if (diff > 15) {
                    bus.status = 'offline';
                }
            }
        });
        res.json(registeredBuses);
    } catch (error) {
        logger.error('Get buses error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/admin/add-bus', async (req, res) => {
    try {
        const { regNo, route, start, destination, stops } = req.body;

        if (!regNo || !route) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        if (mongoose.connection.readyState === 1) {
            const existingBus = await Bus.findOne({ regNo: regNo.toUpperCase() });
            if (existingBus) {
                return res.status(400).json({ error: 'Bus already registered' });
            }

            const bus = new Bus({
                regNo: regNo.toUpperCase(),
                route,
                start: start || '',
                destination: destination || '',
                stops: stops || []
            });

            await bus.save();


            // Create driver account (using updateOne to bypass save hook)
            const bcrypt = require('bcryptjs');
            const driverUsername = regNo.toLowerCase();
            const driverPassword = regNo.toUpperCase() + '1818';

            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(driverPassword, salt);

            await User.updateOne(
                { username: driverUsername },
                {
                    $set: {
                        password: hashedPassword,
                        role: 'driver',
                        busRegNo: regNo.toUpperCase()
                    }
                },
                { upsert: true }
            );

            logger.info(`✅ Driver created: User=${driverUsername} Pass=${driverPassword}`);

            logger.info(`✅ Bus added: ${regNo}`);

            // Broadcast new bus to admin clients
            io.emit('bus-added', bus);

            return res.json({ success: true, message: 'Bus added successfully' });
        }

        if (registeredBuses.find(b => b.regNo === regNo)) {
            return res.status(400).json({ error: 'Bus already registered' });
        }

        registeredBuses.push({
            regNo,
            route,
            start: start || '',
            destination: destination || '',
            stops: stops || [],
            status: 'offline',
            lastSeen: null
        });

        res.json({ success: true, message: 'Bus added' });
    } catch (error) {
        logger.error('Add bus error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.delete('/api/admin/remove-bus/:regNo', async (req, res) => {
    try {
        const { regNo } = req.params;

        if (mongoose.connection.readyState === 1) {
            await Bus.findOneAndDelete({ regNo: regNo.toUpperCase() });
            await User.findOneAndDelete({ busRegNo: regNo.toUpperCase(), role: 'driver' });

            logger.info(`🗑️  Bus removed: ${regNo}`);

            // Broadcast removal
            io.emit('bus-removed', { regNo: regNo.toUpperCase() });

            return res.json({ success: true, message: 'Bus removed' });
        }

        registeredBuses = registeredBuses.filter(b => b.regNo !== regNo);
        delete busLocations[regNo];

        res.json({ success: true, message: 'Bus removed' });
    } catch (error) {
        logger.error('Remove bus error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/all-buses', async (req, res) => {
    try {
        if (mongoose.connection.readyState === 1) {
            const buses = await Bus.find({ status: 'online' }).select('regNo currentLocation');
            return res.json(buses.map(b => ({
                regNo: b.regNo,
                ...b.currentLocation
            })));
        }

        res.json(Object.values(busLocations));
    } catch (error) {
        logger.error('Get all buses error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ==================== SERVE FRONTEND ====================

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/driver', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'driver.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    logger.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
server.listen(PORT, () => {
    logger.info(`🚀 LOCOTrack server running on http://localhost:${PORT}`);
    logger.info(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`🗄️  Database: ${mongoose.connection.readyState === 1 ? 'MongoDB' : 'In-Memory (Fallback)'}`);
    logger.info(`🔌 WebSocket: Enabled`);
    logger.info(`⏰ Cron Jobs: Active (Offline check, Daily backup)`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        logger.info('HTTP server closed');
        mongoose.connection.close(false, () => {
            logger.info('MongoDB connection closed');
            process.exit(0);
        });
    });
});

process.on('SIGINT', () => {
    logger.info('SIGINT signal received: closing HTTP server');
    server.close(() => {
        logger.info('HTTP server closed');
        mongoose.connection.close(false, () => {
            logger.info('MongoDB connection closed');
            process.exit(0);
        });
    });
});

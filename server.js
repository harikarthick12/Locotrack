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
const Organization = require('./models/Organization');
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

// Initialize Default Super Admin
async function initializeAdmin() {
    try {
        const sa = await User.findOne({ role: 'super_admin' });
        if (!sa) {
            // Check if legacy admin exists, convert or create new
            const legacyAdmin = await User.findOne({ username: 'vk18', role: 'admin' });
            if (legacyAdmin) {
                legacyAdmin.role = 'super_admin';
                await legacyAdmin.save();
                logger.info('✅ Legacy "vk18" admin promoted to Super Admin');
            } else {
                const newSa = new User({
                    username: 's_admin', // Default super admin
                    password: 'super_secret_password', // Change this!
                    role: 'super_admin'
                });
                await newSa.save();
                logger.info('✅ Default Super Admin created: s_admin');
            }
        }
    } catch (error) {
        logger.error('Error initializing super admin:', error);
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
            const user = await User.findOne({ username: username.toLowerCase() }).populate('organization');

            if (!user) {
                logger.warn(`Login attempt failed: User not found - ${username}`);
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            // ... (rest of password check) ...

            const isMatch = await user.comparePassword(password);
            if (!isMatch) {
                logger.warn(`Login attempt failed: Wrong password - ${username}`);
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            if (user.role !== type) {
                // Allow Super Admin to log in as 'admin' if requested? No, strict check.
                if (user.role === 'super_admin' && type === 'admin') {
                    // Maybe allowed but let's strict check
                    // Actually Super Admin uses /super logic usually.
                    // Let's stick to strict role check.
                }
                return res.status(401).json({ error: 'Invalid role' });
            }

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
                    organization: user.organization ? user.organization.name : null,
                    organizationCode: user.organization ? user.organization.code : null,
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

// Get Bus Location (by busNumber or regNo)
app.get('/api/bus-location/:identifier', async (req, res) => {
    try {
        const { identifier } = req.params;
        const searchTerm = identifier.toUpperCase();

        if (mongoose.connection.readyState === 1) {
            // Search by busNumber first, then regNo
            const bus = await Bus.findOne({
                $or: [
                    { busNumber: searchTerm },
                    { regNo: searchTerm }
                ]
            });

            if (bus && bus.currentLocation) {
                return res.json(bus.currentLocation);
            }
        }

        const data = busLocations[identifier];
        if (!data) {
            return res.status(404).json({ error: 'Bus not found or offline' });
        }

        res.json(data);
    } catch (error) {
        logger.error('Get bus location error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get Route Details (by busNumber or regNo)
app.get('/api/route-details/:identifier', async (req, res) => {
    try {
        const { identifier } = req.params;
        const searchTerm = identifier.toUpperCase();

        if (mongoose.connection.readyState === 1) {
            const bus = await Bus.findOne({
                $or: [
                    { busNumber: searchTerm },
                    { regNo: searchTerm }
                ]
            });

            if (bus) {
                return res.json({
                    regNo: bus.regNo,
                    busNumber: bus.busNumber,
                    route: bus.route,
                    start: bus.start || '',
                    destination: bus.destination || '',
                    stops: bus.stops || []
                });
            }
        }

        const bus = registeredBuses.find(b => b.regNo === identifier);
        if (!bus) {
            return res.status(404).json({ error: 'Bus not found' });
        }

        res.json({
            regNo: bus.regNo,
            busNumber: bus.busNumber || '',
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

// ==================== PUBLIC APIs ====================

app.get('/api/public/organizations', async (req, res) => {
    try {
        const orgs = await Organization.find({}, 'name code');
        res.json(orgs);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// ==================== SUPER ADMIN APIs ====================

// Super Admin Login
app.post('/api/super/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username, role: 'super_admin' });
        if (!user || !(await user.comparePassword(password))) {
            return res.status(401).json({ error: 'Invalid Super Admin credentials' });
        }
        const token = jwt.sign({ userId: user._id, role: 'super_admin' }, process.env.JWT_SECRET, { expiresIn: '1d' });
        res.json({ success: true, token });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Middleware for Super Admin (Inline for simplicity)
const verifySuper = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ error: 'No token' });
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.role !== 'super_admin') return res.status(403).json({ error: 'Access denied' });
        req.user = decoded;
        next();
    } catch (e) { res.status(401).json({ error: 'Invalid token' }); }
};

// List Organizations
app.get('/api/super/organizations', verifySuper, async (req, res) => {
    try {
        const orgs = await Organization.find();
        // Enrich with bus counts and admin username
        const result = await Promise.all(orgs.map(async org => {
            const busCount = await Bus.countDocuments({ organization: org._id });
            const admin = await User.findOne({ organization: org._id, role: 'admin' });
            return {
                ...org.toObject(),
                busCount,
                adminUsername: admin ? admin.username : null
            };
        }));
        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Create Organization & Admin
app.post('/api/super/organizations', verifySuper, async (req, res) => {
    try {
        const { name, code, adminUser, adminPass } = req.body;

        // 1. Create Org
        const org = new Organization({ name, code });
        await org.save();

        // 2. Create Org Admin
        const admin = new User({
            username: adminUser,
            password: adminPass, // Will be hashed by hook
            role: 'admin',
            organization: org._id
        });
        await admin.save();

        res.json({ success: true, organization: org, admin: admin.username });
    } catch (e) { res.status(400).json({ error: e.message }); }
});

// Delete Organization
app.delete('/api/super/organizations/:id', verifySuper, async (req, res) => {
    try {
        const { id } = req.params;
        await Bus.deleteMany({ organization: id });
        await User.deleteMany({ organization: id });
        await Organization.findByIdAndDelete(id);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});


// ==================== ADMIN APIs ====================

// Middleware for College Admin
const verifyAdmin = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ error: 'No token' });

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.role !== 'admin') return res.status(403).json({ error: 'Access denied. College Admin only.' });

        // Fetch full user to get Organization ID
        const user = await User.findById(decoded.userId);
        if (!user || !user.organization) return res.status(403).json({ error: 'Admin has no organization assigned.' });

        req.user = user; // Contains organization reference
        next();
    } catch (e) { res.status(401).json({ error: 'Invalid token' }); }
};

// Get College Buses
app.get('/api/admin/buses', verifyAdmin, async (req, res) => {
    try {
        // Only return buses for this admin's organization
        const buses = await Bus.find({ organization: req.user.organization }).select('-__v');
        res.json(buses);
    } catch (error) {
        logger.error('Get buses error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Add Bus (Scoped to College)
app.post('/api/admin/add-bus', verifyAdmin, async (req, res) => {
    try {
        const { busNumber, regNo, route, start, destination, stops } = req.body;

        if (!busNumber || !regNo || !route) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Check if bus exists (RegNo must be unique globally, BusNumber unique within Org)
        const existingReg = await Bus.findOne({ regNo: regNo.toUpperCase() });
        if (existingReg) return res.status(400).json({ error: 'Registration Number already exists in the system' });

        const existingNum = await Bus.findOne({
            busNumber: busNumber.toUpperCase(),
            organization: req.user.organization
        });
        if (existingNum) return res.status(400).json({ error: `Bus Number ${busNumber} already exists in your college` });

        const bus = new Bus({
            busNumber: busNumber.toUpperCase(),
            regNo: regNo.toUpperCase(),
            route,
            start: start || '',
            destination: destination || '',
            stops: stops || [],
            organization: req.user.organization, // Assign to Admin's Org
            status: 'offline'
        });

        await bus.save();

        // Also Create Driver Account automatically
        const driverUsername = regNo.toLowerCase();
        const driverPassword = regNo.toUpperCase() + '1818';

        // Check if driver exists
        let driver = await User.findOne({ username: driverUsername });
        if (!driver) {
            driver = new User({
                username: driverUsername,
                password: driverPassword,
                role: 'driver',
                busRegNo: regNo.toUpperCase(),
                organization: req.user.organization
            });
            await driver.save();
        }

        res.status(201).json({
            message: 'Bus added successfully',
            bus,
            driverCredentials: { username: driverUsername, password: driverPassword }
        });

    } catch (error) {
        logger.error('Add bus error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Remove Bus (Scoped)
app.delete('/api/admin/remove-bus/:regNo', verifyAdmin, async (req, res) => {
    try {
        const { regNo } = req.params;

        // Only delete if it belongs to this org
        const result = await Bus.findOneAndDelete({
            regNo: regNo.toUpperCase(),
            organization: req.user.organization
        });

        if (!result) {
            return res.status(404).json({ error: 'Bus not found or does not belong to your college' });
        }

        // Also remove associated driver
        await User.findOneAndDelete({
            busRegNo: regNo.toUpperCase(),
            role: 'driver'
        });

        res.json({ message: 'Bus removed successfully' });
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
    res.sendFile(path.join(__dirname, 'public', 'landing.html'));
});

app.get('/driver', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'driver.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/super', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'superadmin.html'));
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

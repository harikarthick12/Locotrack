# 🚌 LOCOTrack - Live Bus Tracking System

A production-ready, real-time bus tracking system with GPS location sharing, route management, and admin dashboard.

## ✨ Features

- **Real-time GPS Tracking**: Live bus location updates every 5 seconds
- **Multi-view Maps**: Street, Satellite, and Terrain views
- **Route Management**: Define routes with start, destination, and stops
- **Admin Dashboard**: Manage buses, view statistics, and monitor status
- **Driver Portal**: Easy-to-use interface for drivers to share location
- **User Interface**: Track any bus in real-time with accuracy indicators
- **Production-Ready**: MongoDB, JWT authentication, logging, and security

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 or higher)
- MongoDB (local or Atlas cloud)
- Modern web browser

### Installation

1. **Clone/Download the project**
   ```bash
   cd Locotrack
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   - Copy `.env` file and update settings:
   ```env
   MONGODB_URI=mongodb://localhost:27017/locotrack
   JWT_SECRET=your-secret-key-here
   ADMIN_USERNAME=vk18
   ADMIN_PASSWORD=vk18
   ```

4. **Start MongoDB** (if using local)
   ```bash
   mongod
   ```

5. **Run the server**
   ```bash
   npm start
   ```

6. **Access the application**
   - User Interface: http://localhost:3000
   - Driver Portal: http://localhost:3000/driver
   - Admin Dashboard: http://localhost:3000/admin

## 📱 Usage

### For Administrators
1. Go to `/admin`
2. Login with credentials (default: `vk18` / `vk18`)
3. Add buses with route details
4. Monitor live status and statistics

### For Drivers
1. Go to `/driver`
2. Login with Bus Reg No and password (format: `RegNo` + `1818`)
   - Example: Bus `TN01` → Password: `TN011818`
3. Click "Start Sharing Location"
4. Keep the tab open while driving

### For Users
1. Go to `/` (home page)
2. Enter bus registration number
3. Click "Track Now"
4. View live location with route details

## 🔒 Security Features

- ✅ Password hashing with bcrypt
- ✅ JWT token authentication
- ✅ Rate limiting (100 requests per 15 minutes)
- ✅ Helmet.js security headers
- ✅ Input validation
- ✅ Error logging with Winston

## 🗄️ Database Schema

### Bus Model
```javascript
{
  regNo: String (unique),
  route: String,
  start: String,
  destination: String,
  stops: [String],
  status: 'online' | 'offline',
  lastSeen: Date,
  currentLocation: {
    lat: Number,
    lng: Number,
    accuracy: Number,
    updatedAt: Date
  }
}
```

### User Model
```javascript
{
  username: String (unique),
  password: String (hashed),
  role: 'admin' | 'driver',
  busRegNo: String,
  lastLogin: Date
}
```

## 📊 API Endpoints

### Public
- `POST /api/login` - User authentication
- `GET /api/bus-location/:regNo` - Get bus location
- `GET /api/route-details/:regNo` - Get route information
- `GET /api/health` - Health check

### Driver
- `POST /api/update-location` - Update bus location

### Admin
- `GET /api/admin/buses` - Get all buses
- `POST /api/admin/add-bus` - Add new bus
- `DELETE /api/admin/remove-bus/:regNo` - Remove bus

## 🛠️ Technology Stack

- **Backend**: Node.js, Express.js
- **Database**: MongoDB with Mongoose
- **Authentication**: JWT, bcrypt
- **Security**: Helmet, express-rate-limit
- **Logging**: Winston
- **Frontend**: HTML5, CSS3, JavaScript
- **Maps**: Leaflet.js with multiple tile providers

## 📝 Logging

Logs are stored in the `logs/` directory:
- `combined.log` - All logs
- `error.log` - Error logs only

## 🔧 Configuration

All configuration is in `.env`:
- `PORT` - Server port (default: 3000)
- `MONGODB_URI` - MongoDB connection string
- `JWT_SECRET` - Secret key for JWT tokens
- `JWT_EXPIRES_IN` - Token expiration (default: 7d)
- `RATE_LIMIT_WINDOW_MS` - Rate limit window
- `RATE_LIMIT_MAX_REQUESTS` - Max requests per window

## 🚦 Production Deployment

### Using MongoDB Atlas (Cloud)
1. Create account at mongodb.com/atlas
2. Create cluster and get connection string
3. Update `.env`:
   ```
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/locotrack
   ```

### Environment Setup
```bash
NODE_ENV=production npm start
```

### Recommended: Use PM2 for process management
```bash
npm install -g pm2
pm2 start server.js --name locotrack
pm2 save
pm2 startup
```

## 🐛 Troubleshooting

### MongoDB Connection Failed
- Check if MongoDB is running
- Verify connection string in `.env`
- System falls back to in-memory storage automatically

### GPS Not Accurate
- Ensure HTTPS in production (required for GPS)
- Go outside for better GPS signal
- Check browser location permissions

### Login Issues
- Check console logs in `logs/error.log`
- Verify credentials in `.env`
- Clear browser cache and cookies

## 📄 License

MIT License - Feel free to use for personal or commercial projects

## 👨‍💻 Support

For issues or questions, check the logs in `logs/` directory for detailed error information.

---

**Built with ❤️ for efficient bus tracking**

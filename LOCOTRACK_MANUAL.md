# 📖 LOCOTrack: Operational & Technical Manual
**Version 5.0 | The "Crystal Clear Campus" Edition**

---

## 🏗️ Project Overview
**LOCOTrack** is a sophisticated, real-time campus mobility solution designed to bridge the gap between institutional transit management and user accessibility. By leveraging high-frequency GPS telemetry and WebSocket technology, it provides an instantaneous view of fleet movement across multi-tenant campus environments.

---

## ✨ Key Features & Innovation

### 🌓 Theme Intelligence (Modern UX)
- **Crystal Clear UI**: A high-fidelity light theme designed for maximum legibility in daylight.
- **Adaptive Dark Mode**: A system-wide dark theme that protects evening commuters by darkening the UI and **seamlessly switching map tiles** to a nocturnal vector variant.
- **Mobile-Responsive Core**: Surgical CSS breakpoints ensure that the tracking dashboard behaves like a native mobile app on any smartphone.

### 📡 Real-Time Telemetry
- **WebSocket Pipeline**: Instant location updates with 0ms polling delay.
- **Signal Quality Metrics**: Real-time GPS accuracy assessment (Excellent, Fair, Poor) displayed to drivers and admins.
- **ETA & Proximity**: Dynamic calculation of bus-to-user distance and arrival estimation.

### 🏢 Multi-Tenant Architecture
- **Supreme Control**: Ability to provision multiple institutions (Colleges, Districts) under a single host.
- **Organizational Isolation**: Each institution manages only its own fleet, users, and telemetry nodes.

---

## 🎨 Design System: "Crystal Clear Campus"
The project uses a custom design language built from the ground up:
- **Typography**: *Plus Jakarta Sans* for clean, geometric readability.
- **Visuals**: Glassmorphism with `backdrop-filter` for translucent overlays.
- **Iconography**: Rounded, friendly emoji-based icons paired with cobalt signal markers.
- **Grid**: A fluid flex-and-grid hybrid that allows the "Overlay Dashboard" to float elegantly over the telemetry map.

---

## 💻 Technical Architecture

### **Backend (The Engine)**
- **Runtime**: Node.js & Express.js
- **Database**: MongoDB (Mongoose ODM) with an automatic In-Memory Fallback system.
- **Communication**: Socket.io for bi-directional live updates.
- **Process Management**: PM2 with auto-restart and memory monitoring.

### **Frontend (The Interface)**
- **Map Engine**: Leaflet.js with multi-provider tile management (OSM, CartoDB).
- **Styling**: Vanilla CSS3 with global variable injection for theme switching.
- **Logic**: ES6+ JavaScript handling state, authentication, and live data rendering.

### **Security Shell**
- **JWT (JSON Web Tokens)**: Encrypted bearer tokens for management sessions.
- **Bcrypt**: 10-round salted password hashing.
- **Rate Limiting**: Protection against brute-force attacks on login endpoints.
- **Helmet.js**: Enterprise-standard HTTP header security.

---

## 🚀 Deployment & Installation

### Local Environment
1. **Dependencies**: `npm install`
2. **Environment**: Configure `.env` (MongoDB URI, JWT Secret).
3. **Execution**: `npm start` (Production) or `npm run dev` (Development).

### Cloud Environment
1. **Host**: Recommended for Render, Vercel, or AWS EC2.
2. **Persistence**: Use MongoDB Atlas for a distributed database.
3. **Process Control**: Execute via `pm2 start ecosystem.config.js`.

---

## 📊 Database Schema

### User Schema
| Field | Type | Description |
| :--- | :--- | :--- |
| `username` | String | Unique identifier (Lowercase) |
| `password` | String | Salted Bcrypt hash |
| `role` | String | `super_admin`, `admin`, or `driver` |
| `org` | Link | Reference to the Organization ID |

### Bus Schema
| Field | Type | Description |
| :--- | :--- | :--- |
| `regNo` | String | Unique hardware/registration ID |
| `busNumber` | String | Friendly ID (e.g., A4) |
| `route` | String | Destination / Area Name |
| `location` | Object | Lat, Lng, Accuracy, and Timestamp |

---

## 🚥 Operational Flow

1.  **Supreme Admin** creates an **Institution** (e.g., "MIT").
2.  **Institutional Admin** logins and registers **Buses** (e.g., "Bus A4").
3.  **Driver** logs in using the Bus ID and shares their **Live Location**.
4.  **Student** selects their college, enters "A4", and watches the **Live Stream**.

---

## 🛣️ Future Roadmap
1.  **Proximity Push Alerts**: Browser-based notifications when the bus is within 500m.
2.  **Emergency SOS Overlay**: Instant emergency broadcast functionality for drivers.
3.  **Occupancy Monitoring**: Live reporting of bus crowd levels.
4.  **Native PWA**: Converting the web app into an installable mobile app.

---
**LOCOTrack: Efficiency in Motion.**

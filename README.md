# 🚌 LOCOTrack - Intelligent Campus Mobility System

> **A Next-Gen, Multi-Institutional Real-Time Fleet Tracking Ecosystem.**

LOCOTrack is a high-fidelity, production-ready platform designed to modernize campus transportation. It features real-time GPS telemetry, multi-organization architecture, and a surgical "Crystal Clear Campus" design system with native dark mode support.

---

## 💎 The Design System: "Crystal Clear Campus"
LOCOTrack isn't just a utility; it's a visual experience. The **Crystal Clear Campus** design system prioritizes:
- **Light & Airy Aesthetics**: A vibrant light theme using *Trust Blue* (#2563eb) and *Slate Slate* accents.
- **Intelligent Dark Mode**: A system-wide theme engine that dynamically switches UI colors and **Map Tiles** to protect eyes at night.
- **Micro-Animations**: Smooth, surgical transitions and glassmorphic overlays.
- **Mobile-First Responsive Architecture**: Optimized for students and drivers on the move.

---

## 📑 Core Portals

### 🎓 Student Hub (Public)
*   **Live Node Tracing**: Real-time view of buses on a high-contrast map.
*   **Telemetry Data**: Shows current separation distance (km/m) and estimated time of arrival (ETA).
*   **Institutional Filtering**: Select your college to see only relevant fleet data.

### 🚐 Driver Uplink (Pilot)
*   **One-Tap Broadcast**: Simple "Start Sharing" interface for drivers.
*   **GPS Signal Analytics**: Real-time feedback on signal quality (Excellent/Fair/Poor).
*   **Secure Authentication**: Linked directly to specific vehicle registrations.

### 🛡️ Admin Console (Institutional)
*   **Fleet Management**: Full CRUD operations for buses and routes.
*   **Real-Time Statistics**: Live count of online vs. offline vehicles.
*   **Registration Node Control**: Manage start hubs, end hubs, and intermediate waypoints.

### ⭐ Supreme Architect (Global)
*   **Multi-Org Management**: Create and manage entire institutions (Colleges/Universities).
*   **Global Node Control**: Provision institutional admin accounts and fleet allocated capacities.

---

## 🛠️ Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | HTML5, CSS3, Vanilla JS (ES6+) |
| **Styling** | Custom "Crystal" Design System (Light/Dark Mode) |
| **Maps** | Leaflet.js with Dynamic Tile Inversion |
| **Real-time** | Socket.io (WebSocket) |
| **Backend** | Node.js, Express.js |
| **Database** | MongoDB + Mongoose |
| **Security** | JWT, BcryptJS, Helmet.js, Rate Limiting |
| **Logging** | Winston Logger |

---

## 🚀 Installation & Setup

### 1. Prerequisites
- Node.js (v16.x or higher)
- MongoDB Instance (Atlas or Local)
- OpenSSL (for JWT secret generation)

### 2. Local Setup
```bash
# Clone the repository
git clone https://github.com/harikarthick12/Locotrack.git
cd Locotrack

# Install dependencies
npm install

# Setup Environment
cp .env.example .env # Update MONGODB_URI and JWT_SECRET
```

### 3. Running the System
```bash
# Development Mode
npm run dev

# Production Mode
npm start
```

---

## 🗄️ Database Architecture

### `Organization` Model
Primary unit of the multi-tenant system. Holds institutional names, unique codes, and fleet metadata.

### `User` Model
Tri-role system:
- `super_admin`: Global control.
- `admin`: Institutional control (linked to an Org).
- `driver`: Vehicle control (linked to an Org and Bus).

### `Bus` Model
The telemetry heart of the system.
- `regNo`: Unique hardware ID.
- `busNumber`: Friendly ID (Unique within organization).
- `location`: Geo-coordinates, accuracy, and timestamp.

---

## 🌓 Dark Mode Engine
LOCOTrack uses a custom `theme.js` bridge that manages state across all portals.
- **CSS Variable Injection**: Swaps `--bg-main`, `--text-dark`, and `--border` tokens.
- **Map Tile Inversion**: Dynamically switches Leaflet layers to `basemaps.cartocdn.com/dark_all` for a seamless dark navigation experience.

---

## 🔒 Security & Performance
- **Surgical Logging**: Every login attempt and database fallback is recorded via Winston.
- **JWT Protection**: Encapsulated tokens for all management operations.
- **Salted Hashing**: Driver and Admin passwords hashed with 10 salt rounds.
- **In-Memory Fallback**: If MongoDB connection fails, the system provides a temporary in-memory state to prevent complete downtime.

---

## 📈 Roadmap
- [ ] **Smart Proximity Alerts**: Notifications when a bus enters a 500m radius.
- [ ] **Emergency SOS**: Single-tap alert system for drivers during breakdowns.
- [ ] **Schedule Comparison**: Planned vs. Actual time analysis.
- [ ] **Crowd Status**: Driver-reported bus occupancy levels.

---
**Built with ❤️ for a smarter campus experience.**

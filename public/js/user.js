const map = L.map('map').setView([11.0, 78.0], 7); // Default to Tamil Nadu center

// Define Tiles
const lightTiles = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap contributors © CARTO',
    subdomains: 'abcd',
    maxZoom: 20
});

const darkTiles = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap contributors © CARTO',
    subdomains: 'abcd',
    maxZoom: 20
});

// Initial Layer based on theme
const currentTheme = localStorage.getItem('loco-theme') || 'light';
const baseLayer = currentTheme === 'dark' ? darkTiles : lightTiles;
baseLayer.addTo(map);

// Keep track of active base layer
let activeBaseLayer = baseLayer;

// Handle Theme Change for Map
window.addEventListener('storage', (e) => {
    if (e.key === 'loco-theme') {
        const newTheme = e.newValue;
        map.removeLayer(activeBaseLayer);
        activeBaseLayer = newTheme === 'dark' ? darkTiles : lightTiles;
        activeBaseLayer.addTo(map);
    }
});

// Since theme.js calls setTheme which updates data-theme, we can also use a MutationObserver or just a global function
window.updateMapTheme = (theme) => {
    map.removeLayer(activeBaseLayer);
    activeBaseLayer = theme === 'dark' ? darkTiles : lightTiles;
    activeBaseLayer.addTo(map);
};

// Define markers and other variables
let busMarker = null;
let userMarker = null;
let accuracyCircle = null;
let distanceLine = null;
let currentBusReg = null;
let mapCentered = false;
let socket = null;
let userLocation = null;
let userWatchId = null;
let selectedOrgId = null;
let selectedOrgName = null;

// Custom Campus Flow Markers
const busIcon = L.divIcon({
    className: 'custom-bus-marker',
    html: `<div class="custom-dot" style="background: #3b82f6; border: 3px solid white; box-shadow: 0 0 15px rgba(59, 130, 246, 0.4);"></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
});

const userIcon = L.divIcon({
    className: 'custom-user-marker',
    html: `<div class="custom-dot" style="background: #ef4444; border: 3px solid white; box-shadow: 0 0 15px rgba(239, 68, 68, 0.4);"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10]
});

// Get user's location with high accuracy
function getUserLocation() {
    if (!navigator.geolocation) {
        alert('Geolocation is not supported by your browser');
        return;
    }

    if (userWatchId) navigator.geolocation.clearWatch(userWatchId);

    userWatchId = navigator.geolocation.watchPosition(
        (position) => {
            const { latitude, longitude, accuracy } = position.coords;

            // Filter out extremely low accuracy updates (over 1km is usually wrong city)
            if (accuracy > 1000) {
                console.warn('User location accuracy too low:', accuracy);
                return;
            }

            userLocation = { lat: latitude, lng: longitude };

            // Add/Update user marker
            if (userMarker) {
                userMarker.setLatLng([userLocation.lat, userLocation.lng]);
            } else {
                userMarker = L.marker([userLocation.lat, userLocation.lng], {
                    icon: userIcon
                }).addTo(map);
                userMarker.bindPopup('📍 Your Location');
            }

            console.log(`✅ User location [Acc: ${Math.round(accuracy)}m]:`, userLocation);

            // Update distance if bus is being tracked
            if (busMarker) {
                updateDistance();
            }
        },
        (error) => {
            console.error('❌ Error getting location:', error);
            // Only alert once
            if (!userLocation) alert('Unable to get your location. Please enable "Precise Location" in your settings.');
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
}

// Calculate distance between two points (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    return distance;
}

// Update distance display
function updateDistance() {
    if (!userLocation || !busMarker) return;

    const busLatLng = busMarker.getLatLng();
    const distance = calculateDistance(
        userLocation.lat,
        userLocation.lng,
        busLatLng.lat,
        busLatLng.lng
    );

    // Draw line between user and bus
    if (distanceLine) {
        map.removeLayer(distanceLine);
    }

    distanceLine = L.polyline([
        [userLocation.lat, userLocation.lng],
        [busLatLng.lat, busLatLng.lng]
    ], {
        color: '#3b82f6',
        weight: 3,
        opacity: 0.6,
        dashArray: '10, 15'
    }).addTo(map);

    // Update distance in UI
    let distanceDiv = document.getElementById('distanceInfo');
    if (!distanceDiv) {
        distanceDiv = document.createElement('div');
        distanceDiv.id = 'distanceInfo';
        distanceDiv.className = 'bus-info';
        document.getElementById('telemetryData').appendChild(distanceDiv);
    }

    const distanceText = distance < 1
        ? `${(distance * 1000).toFixed(0)}m`
        : `${distance.toFixed(2)}km`;

    const eta = Math.round((distance / 40) * 60);

    distanceDiv.innerHTML = `
        <div class="telemetry-card" style="margin-top: 20px;">
            <div class="info-card-row">
                <div class="field-label">Distance from you</div>
                <span class="info-card-value" style="font-weight: 800; font-family: monospace; color: var(--primary);">${distanceText}</span>
            </div>
            <div class="info-card-row" style="margin-top: 15px;">
                <div class="field-label">Estimated Arrival</div>
                <span class="info-card-value" style="font-weight: 800;">~${eta} SECONDS</span>
            </div>
        </div>
    `;
}

// Initialize Socket.IO
function initializeSocket() {
    socket = io();

    socket.on('connect', () => {
        console.log('✅ Connected to server via WebSocket');
        if (currentBusReg) {
            socket.emit('track-bus', currentBusReg);
        }
    });

    socket.on('location-update', (data) => {
        console.log('📍 Real-time location update:', data);
        updateMapLocation(data);
    });

    socket.on('disconnect', () => {
        console.log('❌ Disconnected from server');
    });
}

async function trackBus() {
    const regNo = document.getElementById('busRegInput').value.trim();
    if (!regNo) {
        alert('Please enter a bus registration number');
        return;
    }

    currentBusReg = regNo.toUpperCase();
    mapCentered = false;

    // Build query params
    const queryParams = new URLSearchParams({
        regNo: currentBusReg,
        orgId: selectedOrgId
    }).toString();

    // Initialize socket if not already done
    if (!socket) {
        initializeSocket();
    }

    // Get user location
    getUserLocation();

    // Join tracking room
    socket.emit('track-bus', currentBusReg);

    // Fetch route details
    await fetchRouteDetails(currentBusReg);

    // Initial fetch
    await updateLocation();

    document.getElementById('busInfo').style.display = 'block';
}

async function loadColleges() {
    try {
        const response = await fetch('/api/public/organizations');
        if (response.ok) {
            const orgs = await response.json();
            const select = document.getElementById('collegeSelect');
            orgs.forEach(org => {
                const opt = document.createElement('option');
                opt.value = org._id;
                opt.textContent = `${org.name} (${org.code})`;
                select.appendChild(opt);
            });

            select.addEventListener('change', (e) => {
                selectedOrgId = e.target.value;
                selectedOrgName = e.target.options[e.target.selectedIndex].text;
                document.getElementById('searchGroup').style.display = 'flex';
                // Adjust placeholder based on college
                document.getElementById('busRegInput').placeholder = `Search ${selectedOrgName.split('(')[0].trim()} Bus (e.g., A4)`;
            });
        }
    } catch (error) {
        console.error('Error loading colleges:', error);
    }
}

async function fetchRouteDetails(regNo) {
    try {
        const response = await fetch(`/api/route-details/${regNo}?orgId=${selectedOrgId}`);
        if (response.ok) {
            const routeData = await response.json();
            displayRouteInfo(routeData);
        }
    } catch (error) {
        console.error('Error fetching route details:', error);
    }
}

function displayRouteInfo(routeData) {
    const busInfo = document.getElementById('busInfo');

    let routeInfoDiv = document.getElementById('routeInfo');
    if (!routeInfoDiv) {
        routeInfoDiv = document.createElement('div');
        routeInfoDiv.id = 'routeInfo';
        routeInfoDiv.className = 'bus-info';
        document.getElementById('telemetryData').appendChild(routeInfoDiv);
    }

    let routeHTML = `
        <div class="telemetry-card" style="margin-top: 20px;">
            <div class="info-card-row">
                <div class="field-label">Bus Number</div>
                <span class="info-card-value" style="font-weight: 800; font-family: monospace;">${routeData.busNumber || '-'}</span>
            </div>
            <div class="info-card-row" style="margin-top: 15px;">
                <div class="field-label">Route Name</div>
                <span class="info-card-value">${routeData.route}</span>
            </div>
            <div class="info-card-row" style="margin-top: 15px;">
                <div class="field-label">Starting Point</div>
                <span class="info-card-value">${routeData.start || '-'}</span>
            </div>
            <div class="info-card-row" style="margin-top: 15px;">
                <div class="field-label">Destination</div>
                <span class="info-card-value">${routeData.destination || '-'}</span>
            </div>
        </div>
    `;

    if (routeData.stops && routeData.stops.length > 0) {
        routeHTML += `
            <div class="telemetry-card" style="margin-top: 20px;">
                <div class="field-label" style="margin-bottom: 12px;">Bus Stops</div>
                <div class="transit-nodes" style="display: flex; flex-wrap: wrap; gap: 10px;">
                    ${routeData.stops.map(stop => `<span class="status-tag" style="background: var(--bg-main); font-size: 0.75rem; border: 1px solid var(--border-rich); color: var(--text-soft);">${stop}</span>`).join('')}
                </div>
            </div>
        `;
    }

    routeInfoDiv.innerHTML = routeHTML;
}

async function updateLocation() {
    try {
        const response = await fetch(`/api/bus-location/${currentBusReg}?orgId=${selectedOrgId}`);

        if (!response.ok) {
            document.getElementById('statusText').innerText = 'Bus Offline / Not Found';
            document.getElementById('statusText').style.color = 'red';
            return;
        }

        const data = await response.json();
        updateMapLocation(data);

    } catch (error) {
        console.error('Error fetching location:', error);
        document.getElementById('statusText').innerText = 'Connection Error';
    }
}

function updateMapLocation(data) {
    const { lat, lng, accuracy, updatedAt } = data;

    const newLatLng = [lat, lng];

    if (busMarker) {
        busMarker.setLatLng(newLatLng);
    } else {
        busMarker = L.marker(newLatLng, { icon: busIcon }).addTo(map);
        busMarker.bindPopup(`🚌 Bus: ${currentBusReg}`);
    }

    // Update Accuracy Circle
    if (accuracy) {
        if (accuracyCircle) {
            accuracyCircle.setLatLng(newLatLng);
            accuracyCircle.setRadius(accuracy);
        } else {
            accuracyCircle = L.circle(newLatLng, {
                radius: accuracy,
                color: '#00E676',
                fillColor: '#00E676',
                fillOpacity: 0.2,
                weight: 1
            }).addTo(map);
        }
    }

    // Center map only on first update
    if (!mapCentered) {
        map.setView(newLatLng, 16);
        mapCentered = true;
    }

    // Update Info
    document.getElementById('statusText').innerText = 'Bus is Live';
    document.getElementById('statusText').style.color = '#059669';

    const date = new Date(updatedAt);
    document.getElementById('lastUpdated').innerText = date.toLocaleTimeString();

    // Update distance if user location is available
    if (userLocation) {
        updateDistance();
    }
}

// Initialize socket and load colleges on page load
initializeSocket();
loadColleges();

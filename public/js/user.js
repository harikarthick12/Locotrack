const map = L.map('map').setView([11.0, 78.0], 7); // Default to Tamil Nadu center

// Define map layers
const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19
});

const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles © Esri',
    maxZoom: 19
});

// Hybrid layer - Satellite with labels
const hybridLayer = L.layerGroup([
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles © Esri',
        maxZoom: 19
    }),
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}.png', {
        attribution: '© CARTO',
        maxZoom: 19
    })
]);

const terrainLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    attribution: 'Map data: © OpenStreetMap contributors, SRTM | Map style: © OpenTopoMap',
    maxZoom: 17
});

// Add default layer (street)
streetLayer.addTo(map);

// Layer control
const baseLayers = {
    "Street View": streetLayer,
    "Satellite (Hybrid)": hybridLayer,
    "Satellite (No Labels)": satelliteLayer,
    "Terrain View": terrainLayer
};

L.control.layers(baseLayers).addTo(map);

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

// Custom Bus Icon
const busIcon = L.icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/3448/3448339.png',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20]
});

// Custom User Icon
const userIcon = L.icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/149/149071.png',
    iconSize: [35, 35],
    iconAnchor: [17, 17],
    popupAnchor: [0, -17]
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
        color: '#4F46E5',
        weight: 3,
        opacity: 0.7,
        dashArray: '10, 10'
    }).addTo(map);

    // Update distance in UI
    let distanceDiv = document.getElementById('distanceInfo');
    if (!distanceDiv) {
        distanceDiv = document.createElement('div');
        distanceDiv.id = 'distanceInfo';
        distanceDiv.style.marginTop = '10px';
        distanceDiv.style.padding = '10px';
        distanceDiv.style.background = '#f0f9ff';
        distanceDiv.style.borderRadius = '8px';
        distanceDiv.style.border = '2px solid #4F46E5';
        document.getElementById('busInfo').appendChild(distanceDiv);
    }

    const distanceText = distance < 1
        ? `${(distance * 1000).toFixed(0)} meters`
        : `${distance.toFixed(2)} km`;

    const eta = Math.round((distance / 40) * 60); // Assuming 40 km/h average speed

    distanceDiv.innerHTML = `
        <p style="margin: 0; font-weight: bold; color: #4F46E5;">
            📏 Distance: ${distanceText}
        </p>
        <p style="margin: 5px 0 0 0; font-size: 0.9rem; color: #666;">
            ⏱️ Estimated arrival: ~${eta} min
        </p>
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

    let routeHTML = `<p><strong>Route:</strong> ${routeData.route}</p>`;

    if (routeData.start || routeData.destination) {
        routeHTML += `<p><strong>Journey:</strong> ${routeData.start || 'N/A'} → ${routeData.destination || 'N/A'}</p>`;
    }

    if (routeData.stops && routeData.stops.length > 0) {
        routeHTML += `<p><strong>Stops:</strong></p><ul style="margin: 5px 0; padding-left: 20px;">`;
        routeData.stops.forEach(stop => {
            routeHTML += `<li>${stop}</li>`;
        });
        routeHTML += `</ul>`;
    }

    let routeInfoDiv = document.getElementById('routeInfo');
    if (!routeInfoDiv) {
        routeInfoDiv = document.createElement('div');
        routeInfoDiv.id = 'routeInfo';
        routeInfoDiv.style.marginTop = '10px';
        routeInfoDiv.style.paddingTop = '10px';
        routeInfoDiv.style.borderTop = '1px solid #eee';
        busInfo.appendChild(routeInfoDiv);
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
    document.getElementById('statusText').innerText = 'Live Tracking (Real-time)';
    document.getElementById('statusText').style.color = 'green';

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

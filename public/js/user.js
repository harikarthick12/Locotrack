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

const terrainLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    attribution: 'Map data: © OpenStreetMap contributors, SRTM | Map style: © OpenTopoMap',
    maxZoom: 17
});

// Add default layer (street)
streetLayer.addTo(map);

// Layer control
const baseLayers = {
    "Street View": streetLayer,
    "Satellite View": satelliteLayer,
    "Terrain View": terrainLayer
};

L.control.layers(baseLayers).addTo(map);

let busMarker = null;
let accuracyCircle = null;
let currentBusReg = null;
let mapCentered = false;
let socket = null;

// Custom Bus Icon
const busIcon = L.icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/3448/3448339.png',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20]
});

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

    // Initialize socket if not already done
    if (!socket) {
        initializeSocket();
    }

    // Join tracking room
    socket.emit('track-bus', currentBusReg);

    // Fetch route details
    await fetchRouteDetails(currentBusReg);

    // Initial fetch
    await updateLocation();

    document.getElementById('busInfo').style.display = 'block';
}

async function fetchRouteDetails(regNo) {
    try {
        const response = await fetch(`/api/route-details/${regNo}`);
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
        const response = await fetch(`/api/bus-location/${currentBusReg}`);

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
}

// Initialize socket on page load
initializeSocket();

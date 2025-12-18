let trackingId = null;
let isTracking = false;
let currentRegNo = null;

document.addEventListener('DOMContentLoaded', () => {
    const savedReg = localStorage.getItem('driverRegNo');
    if (savedReg) {
        currentRegNo = savedReg;
        showTrackingInterface();
    }
});

async function driverLogin() {
    const usernameInput = document.getElementById('driverUsername');
    const passwordInput = document.getElementById('driverPassword');
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    if (!username || !password) {
        alert('Please enter Bus Reg No and Password');
        return;
    }

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'driver', username, password })
        });

        const result = await response.json();

        if (response.ok) {
            currentRegNo = username;
            localStorage.setItem('driverRegNo', currentRegNo);
            showTrackingInterface();
        } else {
            alert(result.error);
        }
    } catch (error) {
        console.error('Login error:', error);
        alert('Login failed');
    }
}

function showTrackingInterface() {
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('trackingSection').style.display = 'block';
    document.getElementById('displayRegNo').innerText = currentRegNo;
}

function driverLogout() {
    stopTracking();
    localStorage.removeItem('driverRegNo');
    currentRegNo = null;
    document.getElementById('trackingSection').style.display = 'none';
    document.getElementById('loginSection').style.display = 'block';
    document.getElementById('driverUsername').value = '';
    document.getElementById('driverPassword').value = '';
}

function toggleTracking() {
    const btn = document.getElementById('toggleBtn');
    const statusIndicator = document.getElementById('statusIndicator');
    const statusText = document.getElementById('statusText');

    if (!isTracking) {
        // Start Tracking
        if (!currentRegNo) {
            alert('Session error. Please logout and login again.');
            return;
        }

        if (!navigator.geolocation) {
            alert('Geolocation is not supported by your browser');
            return;
        }

        // UI Update
        btn.innerText = 'Stop Sharing';
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-danger');

        statusIndicator.style.display = 'block';
        statusIndicator.classList.remove('inactive');
        statusIndicator.classList.add('active', 'pulse');
        statusText.innerText = 'SENDING LOCATION...';

        isTracking = true;

        // Start Geolocation Watch
        trackingId = navigator.geolocation.watchPosition(
            (position) => {
                const { latitude, longitude, accuracy, speed, heading } = position.coords;

                // Validate coordinates (basic sanity check)
                if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
                    console.error('Invalid coordinates received:', latitude, longitude);
                    return;
                }

                // Update UI with signal details
                const accuracyText = accuracy ? `Accuracy: ${Math.round(accuracy)}m` : 'Accuracy: N/A';
                const speedText = speed !== null && speed >= 0 ? ` | Speed: ${Math.round(speed * 3.6)} km/h` : '';

                // SIGNAL FILTERING:
                // If accuracy is poor (> 150m), it's likely IP-based or Cell Tower only.
                // We show it in UI but warn the user and maybe don't send to server if it's too bad.
                const statusIndicator = document.getElementById('statusIndicator');
                let quality = 'POOR';

                if (accuracy <= 25) {
                    quality = 'EXCELLENT';
                    statusIndicator.style.borderColor = '#00E676'; // Green
                    statusIndicator.style.color = '#00E676';
                } else if (accuracy <= 80) {
                    quality = 'GOOD';
                    statusIndicator.style.borderColor = '#AEEA00'; // Lime
                    statusIndicator.style.color = '#AEEA00';
                } else if (accuracy <= 200) {
                    quality = 'FAIR';
                    statusIndicator.style.borderColor = '#FFC107'; // Yellow
                    statusIndicator.style.color = '#FFC107';
                } else {
                    quality = 'BAD (IP-BASED?)';
                    statusIndicator.style.borderColor = '#FF5252'; // Red
                    statusIndicator.style.color = '#FF5252';
                }

                document.getElementById('statusText').innerText = `SIGNAL: ${quality}\n(${accuracyText}${speedText})`;

                // Reject updates that are clearly wrong (e.g. > 500m accuracy)
                if (accuracy > 500) {
                    console.warn('Rejected low accuracy update:', accuracy);
                    return;
                }

                // Log location for debugging
                console.log(`GPS Update [${quality}]: Lat: ${latitude}, Lng: ${longitude}, Accuracy: ${accuracy}m`);

                // Send location
                sendLocation(currentRegNo, latitude, longitude, accuracy);
            },
            (error) => {
                console.error('Error getting location:', error);
                let errorMsg = 'GPS Signal Lost...';

                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        errorMsg = 'GPS Permission Denied';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMsg = 'GPS Position Unavailable';
                        break;
                    case error.TIMEOUT:
                        errorMsg = 'GPS Timeout';
                        break;
                }

                document.getElementById('statusText').innerText = errorMsg;
                document.getElementById('statusText').style.color = 'red';
            },
            {
                enableHighAccuracy: true,
                maximumAge: 0, // Don't use cached position
                timeout: 15000 // 15 seconds timeout
            }
        );

    } else {
        stopTracking();
    }
}

function stopTracking() {
    const btn = document.getElementById('toggleBtn');
    const statusIndicator = document.getElementById('statusIndicator');
    const statusText = document.getElementById('statusText');

    if (trackingId !== null) {
        navigator.geolocation.clearWatch(trackingId);
        trackingId = null;
    }

    isTracking = false;

    btn.innerText = 'Start Sharing Location';
    btn.classList.remove('btn-danger');
    btn.classList.add('btn-primary');

    statusIndicator.classList.remove('active', 'pulse');
    statusIndicator.classList.add('inactive');
    statusText.innerText = 'OFFLINE';
}

async function sendLocation(regNo, lat, lng, accuracy) {
    try {
        const response = await fetch('/api/update-location', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ regNo, lat, lng, accuracy })
        });

        const result = await response.json();
        console.log('Location sent:', result);
    } catch (error) {
        console.error('Error sending location:', error);
    }
}

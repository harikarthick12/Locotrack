document.addEventListener('DOMContentLoaded', () => {
    // Check if already logged in (simple session check via localStorage)
    if (localStorage.getItem('adminLoggedIn') === 'true') {
        showDashboard();
    }

    // Load Colleges for Dropdown
    loadColleges();
});

async function loadColleges() {
    try {
        const res = await fetch('/api/public/organizations');
        const colleges = await res.json();

        const select = document.getElementById('collegeSelect');
        colleges.forEach(col => {
            const opt = document.createElement('option');
            opt.value = col.code; // Store code to match later if needed, or ID
            opt.textContent = `${col.name} (${col.code})`;
            opt.dataset.id = col._id; // Store ID in dataset
            select.appendChild(opt);
        });
    } catch (e) { console.error('Error loading colleges:', e); }
}

async function adminLogin() {
    const usernameInput = document.getElementById('adminUsername');
    const passwordInput = document.getElementById('adminPassword');
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    const collegeSelect = document.getElementById('collegeSelect');
    const selectedCollegeCode = collegeSelect.value;

    if (!selectedCollegeCode) {
        alert('Please select your college from the dropdown');
        return;
    }

    if (!username || !password) {
        alert('Please enter username and password');
        return;
    }

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'admin', username, password })
        });

        const result = await response.json();

        if (response.ok) {
            // Validate that the user actually belongs to the selected college
            // The result.user object now contains organizationCode (populated in server.js)
            if (result.user.organizationCode !== selectedCollegeCode) {
                alert(`Login Failed: This admin account does not belong to the selected college.`);
                // Clean up token just in case
                return;
            }

            localStorage.setItem('adminLoggedIn', 'true');
            localStorage.setItem('adminToken', result.token); // Store token
            localStorage.setItem('collegeName', result.user.organization || 'My College');
            showDashboard();
        } else {
            alert(result.error);
        }
    } catch (error) {
        console.error('Login error:', error);
        alert('Login failed. Check console.');
    }
}

function showDashboard() {
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('dashboardSection').style.display = 'block';

    // Set College Name
    const collegeName = localStorage.getItem('collegeName') || 'My College';
    const nameElem = document.getElementById('adminCollegeName');
    if (nameElem) nameElem.textContent = collegeName;

    fetchBuses();

    // Auto-refresh every 5 seconds
    setInterval(fetchBuses, 5000);
}

function logout() {
    localStorage.removeItem('adminLoggedIn');
    document.getElementById('dashboardSection').style.display = 'none';
    document.getElementById('loginSection').style.display = 'block';
    document.getElementById('adminUsername').value = '';
    document.getElementById('adminPassword').value = '';
}

async function fetchBuses() {
    try {
        const token = localStorage.getItem('adminToken');
        const response = await fetch('/api/admin/buses', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const buses = await response.json();
        renderTable(buses);
        updateStatistics(buses);
    } catch (error) {
        console.error('Error fetching buses:', error);
    }
}

function updateStatistics(buses) {
    const total = buses.length;
    const online = buses.filter(b => b.status === 'online').length;
    const offline = total - online;

    document.getElementById('totalBuses').innerText = total;
    document.getElementById('onlineBuses').innerText = online;
    document.getElementById('offlineBuses').innerText = offline;
}

function renderTable(buses) {
    const tbody = document.getElementById('busTableBody');
    tbody.innerHTML = '';

    if (buses.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">No buses registered yet.</td></tr>';
        return;
    }

    buses.forEach(bus => {
        const tr = document.createElement('tr');

        const statusClass = bus.status === 'online' ? 'online' : 'offline';
        const statusText = bus.status === 'online' ? 'Online' : 'Offline';

        tr.innerHTML = `
            <td><strong style="color: var(--primary); font-weight: 800; font-size: 1.1rem;">${bus.busNumber || '-'}</strong></td>
            <td><span style="font-family: 'JetBrains Mono', monospace; font-size: 0.9rem; color: var(--text-soft); font-weight: 600;">${bus.regNo}</span></td>
            <td><span style="font-weight: 600;">${bus.route}</span></td>
            <td><span class="status-tag ${statusClass}">${statusText}</span></td>
            <td>
                <button class="btn btn-danger" style="padding: 10px 20px; font-size: 0.85rem; width: auto; font-weight: 800; letter-spacing: 0.05em;" onclick="removeBus('${bus.regNo}')">Delete Bus</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function addBus() {
    const busNumber = document.getElementById('newBusNumber').value.trim();
    const regNo = document.getElementById('newBusReg').value.trim();
    const route = document.getElementById('newBusRoute').value.trim();
    const start = document.getElementById('newBusStart').value.trim();
    const destination = document.getElementById('newBusDestination').value.trim();
    const stopsText = document.getElementById('newBusStops').value.trim();

    // Parse stops (one per line)
    const stops = stopsText ? stopsText.split('\n').map(s => s.trim()).filter(s => s) : [];

    if (!busNumber || !regNo || !route) {
        alert('Please fill in Bus Number, Reg No, and Route Name');
        return;
    }

    try {
        const token = localStorage.getItem('adminToken');
        const response = await fetch('/api/admin/add-bus', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ busNumber, regNo, route, start, destination, stops })
        });

        const result = await response.json();
        if (response.ok) {
            alert('Bus Added Successfully!');
            document.getElementById('newBusNumber').value = '';
            document.getElementById('newBusReg').value = '';
            document.getElementById('newBusRoute').value = '';
            document.getElementById('newBusStart').value = '';
            document.getElementById('newBusDestination').value = '';
            document.getElementById('newBusStops').value = '';
            fetchBuses();
        } else {
            alert(result.error);
        }
    } catch (error) {
        console.error('Error adding bus:', error);
    }
}

async function removeBus(regNo) {
    if (!confirm(`Are you sure you want to remove bus ${regNo}?`)) return;

    try {
        const token = localStorage.getItem('adminToken');
        const response = await fetch(`/api/admin/remove-bus/${regNo}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            fetchBuses();
        } else {
            alert('Failed to remove bus');
        }
    } catch (error) {
        console.error('Error removing bus:', error);
    }
}

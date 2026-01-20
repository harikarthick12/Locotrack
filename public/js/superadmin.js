// Super Admin Logic

if (localStorage.getItem('saToken')) {
    showDashboard();
}

async function superLogin() {
    const username = document.getElementById('saUsername').value.trim();
    const password = document.getElementById('saPassword').value.trim();

    if (!username || !password) return alert('Enter credentials');

    try {
        const res = await fetch('/api/super/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (data.success) {
            localStorage.setItem('saToken', data.token);
            showDashboard();
            // Clear inputs
            document.getElementById('saUsername').value = '';
            document.getElementById('saPassword').value = '';
        } else {
            alert(data.error || 'Login failed');
        }
    } catch (e) { console.error(e); alert('Login error'); }
}

function showDashboard() {
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('dashboardSection').style.display = 'block';
    fetchOrganizations();
}

function logout() {
    localStorage.removeItem('saToken');
    document.getElementById('dashboardSection').style.display = 'none';
    document.getElementById('loginSection').style.display = 'block';
}

// Helper to handle fetch with auth
async function fetchAuth(url, options = {}) {
    const token = localStorage.getItem('saToken');
    if (!token) return logout();

    if (!options.headers) options.headers = {};
    options.headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(url, options);

    if (res.status === 401 || res.status === 403) {
        alert('Session Expired. Please login again.');
        logout();
        return null; // Stop execution
    }

    return res;
}

async function fetchOrganizations() {
    const res = await fetchAuth('/api/super/organizations');
    if (!res) return;

    const orgs = await res.json();
    const tbody = document.getElementById('orgTableBody');
    tbody.innerHTML = '';

    if (orgs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 20px;">No colleges found. Add one from the sidebar.</td></tr>';
        return;
    }

    orgs.forEach(org => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong style="color: var(--supreme); font-weight: 800; font-size: 1.1rem;">${org.code}</strong></td>
            <td><span style="font-weight: 600;">${org.name}</span></td>
            <td><span style="font-family: 'JetBrains Mono', monospace; color: var(--text-soft); font-weight: 600;">${org.adminUsername || 'None'}</span></td>
            <td><span class="status-tag" style="background: var(--supreme-light); color: var(--supreme);">${org.busCount || 0} Registered Nodes</span></td>
            <td><button class="btn btn-danger" style="padding: 10px 20px; font-size: 0.85rem; width: auto; font-weight: 800; letter-spacing: 0.05em;" onclick="deleteOrg('${org._id}')">Decommission</button></td>
        `;
        tbody.appendChild(tr);
    });
}

async function addOrganization() {
    const name = document.getElementById('newOrgName').value.trim();
    const code = document.getElementById('newOrgCode').value.trim();
    const adminUser = document.getElementById('newOrgAdminUser').value.trim();
    const adminPass = document.getElementById('newOrgAdminPass').value.trim();

    if (!name || !code || !adminUser || !adminPass) return alert('All fields required');

    const res = await fetchAuth('/api/super/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, code, adminUser, adminPass })
    });
    if (!res) return;

    const data = await res.json();
    if (data.success) {
        alert('College Created Successfully!');
        fetchOrganizations();
        // Clear inputs
        document.querySelectorAll('#dashboardSection input').forEach(i => i.value = '');
    } else {
        alert(data.error || 'Failed to create college');
    }
}

async function deleteOrg(id) {
    if (!confirm('Delete this college? This will delete ALL associated buses and admins.')) return;

    const res = await fetchAuth(`/api/super/organizations/${id}`, {
        method: 'DELETE'
    });
    if (!res) return;

    fetchOrganizations();
}


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
        } else {
            alert(data.error);
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
    location.reload();
}

async function fetchOrganizations() {
    const token = localStorage.getItem('saToken');
    const res = await fetch('/api/super/organizations', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const orgs = await res.json();
    const tbody = document.getElementById('orgTableBody');
    tbody.innerHTML = '';

    orgs.forEach(org => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong class="royal-text" style="font-family: 'Outfit'; font-size: 1.1rem;">${org.code}</strong></td>
            <td style="font-weight: 500;">${org.name}</td>
            <td style="font-family: monospace; color: #94a3b8;">${org.adminUsername || 'None'}</td>
            <td><span class="status-badge" style="background: rgba(251, 191, 36, 0.1); color: #fbbf24;">${org.busCount || 0} Buses</span></td>
            <td><button class="btn btn-danger btn-sm" style="padding: 6px 12px; border: 1px solid rgba(239, 68, 68, 0.3); background: transparent;" onclick="deleteOrg('${org._id}')">Delete</button></td>
        `;
        tbody.appendChild(tr);
    });
}

async function addOrganization() {
    const name = document.getElementById('newOrgName').value.trim();
    const code = document.getElementById('newOrgCode').value.trim();
    const adminUser = document.getElementById('newOrgAdminUser').value.trim();
    const adminPass = document.getElementById('newOrgAdminPass').value.trim();
    const token = localStorage.getItem('saToken');

    if (!name || !code || !adminUser || !adminPass) return alert('All fields required');

    const res = await fetch('/api/super/organizations', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name, code, adminUser, adminPass })
    });

    const data = await res.json();
    if (data.success) {
        alert('College Created!');
        fetchOrganizations();
        // Clear inputs
        document.querySelectorAll('input').forEach(i => i.value = '');
    } else {
        alert(data.error);
    }
}

async function deleteOrg(id) {
    if (!confirm('Delete this college? This will delete ALL associated buses and admins.')) return;
    const token = localStorage.getItem('saToken');
    await fetch(`/api/super/organizations/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    fetchOrganizations();
}

// Check session
if (localStorage.getItem('saToken')) showDashboard();

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

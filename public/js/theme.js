// Theme Management Logic with Draggable Functionality
const themeToggle = document.createElement('div');
themeToggle.className = 'theme-toggle';
themeToggle.id = 'themeToggle';
themeToggle.innerHTML = '🌓';
themeToggle.title = 'Switch Theme (Drag to Move)';
document.body.appendChild(themeToggle);

// Persistent Position Logic
const savedX = localStorage.getItem('theme-toggle-x');
const savedY = localStorage.getItem('theme-toggle-y');
if (savedX && savedY) {
    themeToggle.style.left = savedX + 'px';
    themeToggle.style.top = savedY + 'px';
    themeToggle.style.right = 'auto'; // Disable fixed right/top
}

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('loco-theme', theme);
    themeToggle.innerHTML = theme === 'dark' ? '☀️' : '🌙';

    // Update Leaflet Map if present
    if (typeof map !== 'undefined' && map.eachLayer) {
        map.eachLayer(layer => {
            if (layer._url && (layer._url.includes('openstreetmap') || layer._url.includes('cartocdn'))) {
                const darkTiles = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
                const lightTiles = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
                layer.setUrl(theme === 'dark' ? darkTiles : lightTiles);
            }
        });
    }
}

const savedTheme = localStorage.getItem('loco-theme') ||
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

setTheme(savedTheme);

// Draggable Logic
let isDragging = false;
let startX, startY;
let initialX, initialY;
let clickPrevented = false;

themeToggle.addEventListener('mousedown', dragStart);
themeToggle.addEventListener('touchstart', dragStart, { passive: false });

function dragStart(e) {
    isDragging = true;
    clickPrevented = false;

    // Support Touch and Mouse
    const clientX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
    const clientY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;

    startX = clientX;
    startY = clientY;

    const rect = themeToggle.getBoundingClientRect();
    initialX = rect.left;
    initialY = rect.top;

    themeToggle.style.transition = 'none'; // Smooth drag

    if (e.type === 'mousedown') {
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', dragEnd);
    } else {
        document.addEventListener('touchmove', drag, { passive: false });
        document.addEventListener('touchend', dragEnd);
    }
}

function drag(e) {
    if (!isDragging) return;

    const clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
    const clientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;

    const dx = clientX - startX;
    const dy = clientY - startY;

    // Minimum threshold for dragging vs clicking
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        clickPrevented = true;
    }

    let newX = initialX + dx;
    let newY = initialY + dy;

    // Keep within bounds
    const threshold = 10;
    const maxX = window.innerWidth - themeToggle.offsetWidth - threshold;
    const maxY = window.innerHeight - themeToggle.offsetHeight - threshold;

    newX = Math.max(threshold, Math.min(newX, maxX));
    newY = Math.max(threshold, Math.min(newY, maxY));

    themeToggle.style.left = newX + 'px';
    themeToggle.style.top = newY + 'px';
    themeToggle.style.right = 'auto';

    if (e.type === 'touchmove') e.preventDefault();
}

function dragEnd() {
    isDragging = false;
    themeToggle.style.transition = 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';

    // Save position
    const rect = themeToggle.getBoundingClientRect();
    localStorage.setItem('theme-toggle-x', rect.left);
    localStorage.setItem('theme-toggle-y', rect.top);

    document.removeEventListener('mousemove', drag);
    document.removeEventListener('mouseup', dragEnd);
    document.removeEventListener('touchmove', drag);
    document.removeEventListener('touchend', dragEnd);
}

themeToggle.addEventListener('click', (e) => {
    if (clickPrevented) return;
    const currentTheme = document.documentElement.getAttribute('data-theme');
    setTheme(currentTheme === 'dark' ? 'light' : 'dark');
});

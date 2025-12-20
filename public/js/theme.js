// Theme Management Logic
const themeToggle = document.createElement('div');
themeToggle.className = 'theme-toggle';
themeToggle.id = 'themeToggle';
themeToggle.innerHTML = '🌓';
themeToggle.title = 'Switch Theme';
document.body.appendChild(themeToggle);

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('loco-theme', theme);
    themeToggle.innerHTML = theme === 'dark' ? '☀️' : '🌙';

    // Update Leaflet Map if present
    if (typeof map !== 'undefined' && map.eachLayer) {
        map.eachLayer(layer => {
            if (layer._url && layer._url.includes('openstreetmap')) {
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

themeToggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    setTheme(currentTheme === 'dark' ? 'light' : 'dark');
});

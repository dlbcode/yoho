import { flightMap } from './flightMap.js';
import { updateState } from './stateManager.js';
import { infoPane } from './infoPane.js';
import { mapHandling } from './mapHandling.js';

async function initMapFunctions() {
    // With our new URL format, we no longer need to parse waypoints, dates, and tripTypes separately
    // Instead, our parseUrlRoutes function now handles everything

    // Just set the route direction if specified
    const params = new URLSearchParams(window.location.search);
    const routeDirection = params.get('direction') || 'from';
    updateState('routeDirection', routeDirection, 'map.initMapFunctions');
    
    // The rest of the initialization will happen in parseUrlRoutes
}

// Remove these obsolete functions since they're no longer needed with the new URL format
// async function getWaypoints(waypointParam) { ... }
// function getRouteDates(routeDatesParam) { ... }
// function getTripTypes(typesParam) { ... }

const map = L.map('map', {
    zoomControl: false,
    minZoom: 1,
    maxZoom: 19,
    worldCopyJump: true
}).setView([0, 0], 4);

L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

L.control.zoom({ position: 'bottomright' }).addTo(map);

if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
        position => map.setView([position.coords.latitude, position.coords.longitude], 4),
        error => console.error('Geolocation API Error:', error)
    );
} else {
    console.error('Geolocation API not supported by this browser.');
}

document.getElementById('map').style.height = `${window.innerHeight}px`;
document.addEventListener('DOMContentLoaded', () => {
    initMapFunctions();
    infoPane.init();
    adjustMapSize();
    mapHandling.initMapContainer(map);
});

function adjustMapSize() {
    const mapElement = document.getElementById('map');
    const infoPane = document.getElementById('infoPane');
    if (!mapElement || !infoPane) return;

    const infoPaneHeight = infoPane.offsetHeight;
    const viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    mapElement.style.height = `${viewportHeight - infoPaneHeight}px`;

    if (window.map) map.invalidateSize();
}

const blueDotIcon = createDotIcon('#3B74D5', 8);
const magentaDotIcon = createDotIcon('#b43bd5', 10);
const greenDotIcon = createDotIcon('#419c54', 10);

function createDotIcon(color, size) {
    return L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="background-color: ${color}; width: ${size}px; height: ${size}px; border-radius: 50%;"></div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2]
    });
}

export { map, blueDotIcon, magentaDotIcon, greenDotIcon, adjustMapSize };
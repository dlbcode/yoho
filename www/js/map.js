import { flightMap } from './flightMap.js';
import { routeList } from './routeList.js';
import { updateState } from './stateManager.js';
import { infoPane } from './infoPane.js';

async function initMapFunctions() {
    await flightMap.plotRoutePaths(); // Wait for routes data to be loaded and processed
    routeList.initTravelerControls();

    const params = new URLSearchParams(window.location.search);
    const waypointParam = params.get('waypoints');
    if (waypointParam) {
        const waypointIatas = waypointParam.split(',').map(decodeURIComponent);
        for (const iata of waypointIatas) {
            const airport = await flightMap.getAirportDataByIata(iata);
            if (airport) {
                updateState('addWaypoint', airport);
            }
        }
    }

    document.dispatchEvent(new CustomEvent('waypointsLoadedFromURL'));
}

// Marker configurations
var blueDotIcon = L.divIcon({
    className: 'custom-div-icon',
    html: '<div style="background-color: #3B74D5; width: 8px; height: 8px; border-radius: 50%;"></div>',
    iconSize: [8, 8],
    iconAnchor: [5, 5]
});

var magentaDotIcon = L.divIcon({
    className: 'custom-div-icon',
    html: '<div style="background-color: #b43bd5; width: 8px; height: 8px; border-radius: 50%;"></div>',
    iconSize: [8, 8],
    iconAnchor: [5, 5]
});

var map = L.map('map', { 
    zoomControl: false, 
    minZoom: 2, 
    maxZoom: 19,
    worldCopyJump: true // This option makes the map jump to the original world copy
});

// Default view settings
map.setView([0, 0], 4);

// Tile layer settings
L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Zoom control settings
L.control.zoom({
    position: 'bottomright'
}).addTo(map);

// Fetch client's approximate location using IP-API
fetch('http://ip-api.com/json/')
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            // Set map view to the obtained location
            map.setView([data.lat, data.lon], 4);
        } else {
            console.error('IP Geolocation failed:', data.message);
        }
    })
    .catch(error => {
        console.error('Error fetching IP Geolocation:', error);
    });

// Initial resize on load
document.getElementById('map').style.height = window.innerHeight + 'px';
document.addEventListener('DOMContentLoaded', () => {
    initMapFunctions();
    infoPane.init();
    adjustMapHeight();
});

window.addEventListener('resize', adjustMapHeight);

function adjustMapHeight() {
    const mapElement = document.getElementById('map');
    const infoPaneHeight = 165; // Height of the infoPane
    const windowHeight = window.innerHeight;
    mapElement.style.height = `${windowHeight - infoPaneHeight}px`;
}



// Export the map and the icons for use in other modules
export { map, blueDotIcon, magentaDotIcon };

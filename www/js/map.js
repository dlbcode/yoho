import { flightMap } from './flightMap.js';
import { flightList } from './flightList.js';

// Marker configurations
var blueDotIcon = L.divIcon({
    className: 'custom-div-icon',
    html: '<div style="background-color: #3B74D5; width: 10px; height: 10px; border-radius: 50%;"></div>',
    iconSize: [10, 10],
    iconAnchor: [5, 5]
});

var magentaDotIcon = L.divIcon({
    className: 'custom-div-icon',
    html: '<div style="background-color: #b43bd5; width: 10px; height: 10px; border-radius: 50%;"></div>',
    iconSize: [10, 10],
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

// Initialize map-related functionalities
function initMapFunctions() {
    flightMap.plotFlightPaths();
    flightList.initTravelerControls();
}

// Initial resize on load
document.getElementById('map').style.height = window.innerHeight + 'px';
document.addEventListener('DOMContentLoaded', initMapFunctions);

// Export the map and the icons for use in other modules
export { map, blueDotIcon, magentaDotIcon };

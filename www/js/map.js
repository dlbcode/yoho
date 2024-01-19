import { flightMap } from './flightMap.js';
import { routeList } from './routeList.js';
import { updateState, appState } from './stateManager.js';
import { getPrice } from './getPrice.js';
import { infoPane } from './infoPane.js';

async function initMapFunctions() {
    routeList.initTravelerControls();
    
    const params = new URLSearchParams(window.location.search);
    const waypointParam = params.get('waypoints');
    if (waypointParam) {
        const waypointIatas = waypointParam.split(',').map(decodeURIComponent);
        const airports = [];
        for (const iata of waypointIatas) {
            const airport = await flightMap.getAirportDataByIata(iata);
            if (airport) {
                airports.push(airport);
            }
        }
        updateState('addWaypoint', airports); // Add all waypoints in one operation
    }

    document.dispatchEvent(new CustomEvent('waypointsLoadedFromURL'));
}

function waitForRoutesUpdate() {
    return new Promise(resolve => {
        const listener = () => {
            document.removeEventListener('routesArrayUpdated', listener);
            resolve();
        };
        document.addEventListener('routesArrayUpdated', listener);
    });
}

var blueDotIcon = L.divIcon({ // Marker configurations
    className: 'custom-div-icon',
    html: '<div style="background-color: #3B74D5; width: 8px; height: 8px; border-radius: 50%;"></div>',
    iconSize: [8, 8],
    iconAnchor: [5, 5]
});

var magentaDotIcon = L.divIcon({
    className: 'custom-div-icon',
    html: '<div style="background-color: #b43bd5; width: 10px; height: 10px; border-radius: 50%;"></div>',
    iconSize: [10, 10],
    iconAnchor: [6, 6]
});

var map = L.map('map', { 
    zoomControl: false, 
    minZoom: 2, 
    maxZoom: 19,
    worldCopyJump: true // This option makes the map jump to the original world copy
});

map.setView([0, 0], 4); // Default view settings

L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png', { // Tile layer settings
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

L.control.zoom({ // Zoom control settings
    position: 'bottomright'
}).addTo(map);

fetch('http://ip-api.com/json/') // Fetch client's approximate location using IP-API
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') { // Set map view to the obtained location
            map.setView([data.lat, data.lon], 4);
        } else {
            console.error('IP Geolocation failed:', data.message);
        }
    })
    .catch(error => {
        console.error('Error fetching IP Geolocation:', error);
    });

document.getElementById('map').style.height = window.innerHeight + 'px'; // Initial resize on load
document.addEventListener('DOMContentLoaded', () => {
    initMapFunctions();
    getPrice.init();
    infoPane.init();
    adjustMapHeight();
});

window.addEventListener('resize', adjustMapHeight);

function adjustMapHeight() {
    const mapElement = document.getElementById('map');
    const infoPaneHeight = 144; // Height of the infoPane
    const windowHeight = window.innerHeight;
    mapElement.style.height = `${windowHeight - infoPaneHeight}px`;
}

export { map, blueDotIcon, magentaDotIcon };

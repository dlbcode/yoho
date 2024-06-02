import { flightMap } from './flightMap.js';
import { appState, updateState } from './stateManager.js';
import { infoPane } from './infoPane.js';
import { mapHandling } from './mapHandling.js';

async function initMapFunctions() {
    const params = new URLSearchParams(window.location.search);
    let waypoints = null;
    let routeDirection = null;
    let routeDates = [];
    let tripTypes = {};

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
        waypoints = airports;
    }

    const directionParam = params.get('direction');
    if (directionParam) {
        routeDirection = directionParam;
    }

    const routeDatesParam = params.get('dates');
    if (routeDatesParam) {
        const datePairs = routeDatesParam.split(',');
        datePairs.forEach(pair => {
            const [key, type, value] = pair.split(':');
            const routeNumber = parseInt(key, 10);
            const date = (value === 'null' || value === 'undefined') ? null : value;
            if (!routeDates[routeNumber]) {
                routeDates[routeNumber] = { routeNumber, depart: null, return: null };
            }
            if (type === 'depart') {
                routeDates[routeNumber].depart = date;
            } else if (type === 'return') {
                routeDates[routeNumber].return = date;
            }
        });
    }

    const typesParam = params.get('types');
    if (typesParam) {
        typesParam.split(',').forEach(pair => {
            const [routeNumber, tripType] = pair.split(':');
            tripTypes[parseInt(routeNumber, 10)] = tripType;
        });
    }

    // Make the updateState function calls
    if (routeDirection) {
        updateState('routeDirection', routeDirection, 'map.initMapFunctions1');
    }
    routeDates.forEach(routeDate => {
        updateState('updateRouteDate', routeDate, 'map.initMapFunctions2');
    });
    if (waypoints) {
        updateState('addWaypoint', waypoints, 'map.initMapFunctions3');
    }
    Object.entries(tripTypes).forEach(([routeNumber, tripType]) => {
        updateState('tripType', { routeNumber: parseInt(routeNumber, 10), tripType }, 'map.initMapFunctions4');
    });
}

var map = L.map('map', { 
    zoomControl: false, 
    minZoom: 2, 
    maxZoom: 19,
    worldCopyJump: true 
});

map.setView([0, 0], 4);

L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

L.control.zoom({
    position: 'bottomright'
}).addTo(map);

// Use HTML5 Geolocation API to fetch client's location
if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(function(position) {
        map.setView([position.coords.latitude, position.coords.longitude], 4);
    }, function(error) {
        console.error('Geolocation API Error:', error);
    });
} else {
    console.error('Geolocation API not supported by this browser.');
}

document.getElementById('map').style.height = window.innerHeight + 'px';
document.addEventListener('DOMContentLoaded', () => {
    initMapFunctions();
    infoPane.init();
    adjustMapSize();
    mapHandling.initMapContainer(map);
});

function adjustMapSize() {
    const mapElement = document.getElementById('map');
    const infoPaneHeight = document.getElementById('infoPane').offsetHeight;
    const windowHeight = window.innerHeight;
    const newMapHeight = windowHeight - infoPaneHeight;
    mapElement.style.height = `${newMapHeight}px`;

    if (window.map) {
        map.invalidateSize();
    }    
}

window.addEventListener('resize', adjustMapSize);
window.addEventListener('orientationchange', adjustMapSize);

document.addEventListener('DOMContentLoaded', adjustMapSize);

var blueDotIcon = L.divIcon({
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

var greenDotIcon = L.divIcon({
    className: 'custom-div-icon',
    html: '<div style="background-color: #419c54; width: 10px; height: 10px; border-radius: 50%;"></div>',
    iconSize: [10, 10],
    iconAnchor: [6, 6]
});

export { map, blueDotIcon, magentaDotIcon, greenDotIcon, adjustMapSize };

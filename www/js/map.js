import { flightMap } from './flightMap.js';
import { updateState } from './stateManager.js';
import { infoPane } from './infoPane.js';
import { mapHandling } from './mapHandling.js';

async function initMapFunctions() {
    const params = new URLSearchParams(window.location.search);
    const waypoints = await getWaypoints(params.get('waypoints'));
    const routeDates = getRouteDates(params.get('dates'));
    const tripTypes = getTripTypes(params.get('types'));
    const routeDirection = params.get('direction') || 'from';

    updateState('routeDirection', routeDirection, 'map.initMapFunctions1');
    routeDates.forEach(routeDate => updateState('updateRouteDate', routeDate, 'map.initMapFunctions2'));
    if (waypoints) updateState('addWaypoint', waypoints, 'map.initMapFunctions3');
    Object.entries(tripTypes).forEach(([routeNumber, tripType]) => {
        updateState('tripType', { routeNumber: parseInt(routeNumber, 10), tripType }, 'map.initMapFunctions4');
    });
}

async function getWaypoints(waypointParam) {
    if (!waypointParam) return null;
    const waypointIatas = waypointParam.split(',').map(decodeURIComponent);
    const airports = await Promise.all(waypointIatas.map(iata => flightMap.getAirportDataByIata(iata)));
    return airports.filter(Boolean);
}

function getRouteDates(routeDatesParam) {
    if (!routeDatesParam) {
        return [{ routeNumber: 0, depart: new Date().toISOString().split('T')[0], return: null }];
    }
    return routeDatesParam.split(',').reduce((acc, pair) => {
        const [key, type, value] = pair.split(':');
        const routeNumber = parseInt(key, 10);
        const date = (value === 'null' || value === 'undefined') ? null : value;
        if (!acc[routeNumber]) acc[routeNumber] = { routeNumber, depart: null, return: null };
        acc[routeNumber][type] = date;
        return acc;
    }, []);
}

function getTripTypes(typesParam) {
    if (!typesParam) return {};
    return typesParam.split(',').reduce((acc, pair) => {
        const [routeNumber, tripType] = pair.split(':');
        acc[parseInt(routeNumber, 10)] = tripType;
        return acc;
    }, {});
}

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
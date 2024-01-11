import { map, blueDotIcon, magentaDotIcon } from './map.js';
import { flightMap } from './flightMap.js';
import { routeList } from './routeList.js';
import { pathDrawing } from './pathDrawing.js';
import { drawAllRoutePaths } from './allPaths.js';
import { appState, updateState } from './stateManager.js';

function handleStateChange(event) {
    const { key, value } = event.detail;

    if (key === 'addWaypoint' || key === 'removeWaypoint' || key === 'updateWaypoint') {
        // Clear existing waypoint fields
        const container = document.querySelector('.airport-selection');
        container.innerHTML = '';

        // Recreate waypoint fields based on the current waypoints
        appState.waypoints.forEach((waypoint, index) => {
            let waypointField = createWaypointField(index + 1);
            waypointField.value = `${waypoint.city} (${waypoint.iata_code})`;
        });

        // Update marker icons based on the current waypoints
        updateMarkerIcons();

        // Create an additional field for the next waypoint
        createWaypointField(appState.waypoints.length + 1);

        // Update routes array based on the current waypoints
        updateRoutesArray();
        console.table(appState.routes);
        pathDrawing.clearLines();
        pathDrawing.drawLines();

        console.log('appState: updating price');
        routeList.updateTotalCost();
    }

    if (key === 'clearData') {
        // Clear existing waypoint fields
        const container = document.querySelector('.airport-selection');
        container.innerHTML = '';
        createWaypointField(1); // Create the first waypoint field
    }    
}

function updateMarkerIcons() {
    console.log('appState: updating marker icons');
    const waypointIataCodes = new Set(appState.waypoints.map(waypoint => waypoint.iata_code));
    Object.entries(flightMap.markers).forEach(([iata, marker]) => {
        marker.setIcon(waypointIataCodes.has(iata) ? magentaDotIcon : blueDotIcon);
    });
}

function updateRoutesArray() {
    appState.routes = [];
    for (let i = 0; i < appState.waypoints.length - 1; i++) {
        const fromWaypoint = appState.waypoints[i];
        const toWaypoint = appState.waypoints[i + 1];
        let route = flightMap.findRoute(fromWaypoint.iata_code, toWaypoint.iata_code);

        if (route) {
            route.isDirect = true;
            appState.routes.push(route);
        } else {
            const indirectRoute = {
                originAirport: fromWaypoint,
                destinationAirport: toWaypoint,
                isDirect: false
            };
            appState.routes.push(indirectRoute);
        }
    }
}

function createWaypointField(index) {
    const container = document.querySelector('.airport-selection');
    const input = document.createElement('input');
    input.type = 'text';
    input.id = `waypoint${index}`;
    input.placeholder = `Select Airport`;
    container.appendChild(input);

    const suggestionsDiv = document.createElement('div');
    suggestionsDiv.id = `waypoint${index}Suggestions`;
    suggestionsDiv.className = 'suggestions';
    container.appendChild(suggestionsDiv);

    // Emit custom event after creating a new waypoint field
    document.dispatchEvent(new CustomEvent('newWaypointField', { detail: { fieldId: input.id } }));

    return input;
}

const eventManager = {
    setupEventListeners: function () {
        this.setupMapEventListeners();
        this.setupUIEventListeners();
        this.setupAllPathsButtonEventListener();
        document.addEventListener('stateChange', handleStateChange);
        document.addEventListener('waypointsLoadedFromURL', () => {
            updateRoutesArray();
        });
    },

    setupMapEventListeners: function () {
        map.on('click', () => {
            flightMap.selectedMarker = null;
        });

        map.on('moveend', () => {
            flightMap.redrawMarkers();
            flightMap.updateVisibleMarkers();
        });

        map.on('zoomend', () => {
            flightMap.updateVisibleMarkers();
        });
    },

    setupUIEventListeners: function () {
        document.addEventListener('change', function (event) {
            if (event.target.id === 'routePathToggle') {
                updateState('routePathToggle', event.target.value);
                if (flightMap.selectedMarker) {
                    pathDrawing.drawRoutePaths(flightMap.selectedMarker);
                }
            }
        });

        document.addEventListener('click', function (event) {
            if (event.target.id === 'increaseTravelers') {
                updateState('numTravelers', appState.numTravelers + 1);
                routeList.updateTotalCost();
            } else if (event.target.id === 'decreaseTravelers' && appState.numTravelers > 1) {
                updateState('numTravelers', appState.numTravelers - 1);
                routeList.updateTotalCost();
            } else if (event.target.id === 'clearBtn') {
                updateState('clearData', null);
                routeList.updateTotalCost();
                pathDrawing.clearLines();
                // pathDrawing.drawLines();
                updateMarkerIcons(); // Reset marker icons
            }            
        });

        map.addEventListener('zoomChanged', function () {
            flightMap.updateMarkersForZoom();
        });
    },

    setupAllPathsButtonEventListener: function () {
        document.addEventListener('click', function (event) {
            if (event.target.id === 'allPathsBtn') {
                drawAllRoutePaths();
            }
        });
    },

    attachMarkerEventListeners: function (iata, marker, airport) {
        marker.on('mouseover', () => flightMap.markerHoverHandler(iata, 'mouseover'));
        marker.on('mouseout', () => flightMap.markerHoverHandler(iata, 'mouseout'));
        marker.on('click', () => { flightMap.handleMarkerClick(airport, marker); });
    },

    emitCustomEvent: function (eventName, data) {
        switch (eventName) {
            case 'markerCreated':
                this.attachMarkerEventListeners(data.iata, data.marker, data.airport);
                break;
        }
    },
};

window.addEventListener('resize', function () {
    const height = window.innerHeight;
    document.getElementById('map').style.height = height + 'px';
});

document.addEventListener('DOMContentLoaded', function () {
    eventManager.setupEventListeners();
});

window.addEventListener('popstate', function(event) {
    // Parse the URI to get the updated waypoints
    const params = new URLSearchParams(window.location.search);
    const waypointParam = params.get('waypoints');
    const waypointIatas = waypointParam ? waypointParam.split(',').map(decodeURIComponent) : [];

    // Clear existing waypoints and add new ones from the URI
    updateState('clearData', null);
    waypointIatas.forEach(async (iata) => {
        const airport = await flightMap.getAirportDataByIata(iata);
        if (airport) {
            updateState('addWaypoint', airport);
        }
    });
});

export { eventManager };

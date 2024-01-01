import { map, blueDotIcon, magentaDotIcon } from './map.js';
import { flightMap } from './flightMap.js';
import { flightList } from './flightList.js';
import { pathDrawing } from './pathDrawing.js';
import { getIataFromField } from './airportAutocomplete.js';
import { drawAllFlightPaths } from './allPaths.js';
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

        // Update flights array based on the current waypoints
        updateFlightsArray();
        console.table(appState.flights);
        pathDrawing.clearFlightPaths();

        console.log('appState: updating price');
        flightList.updateTotalCost();
    }
}

function updateMarkerIcons() {
    console.log('appState: updating marker icons');
    const waypointIataCodes = new Set(appState.waypoints.map(waypoint => waypoint.iata_code));
    Object.entries(flightMap.markers).forEach(([iata, marker]) => {
        marker.setIcon(waypointIataCodes.has(iata) ? magentaDotIcon : blueDotIcon);
    });
}

function updateFlightsArray() {
    appState.flights = [];
    for (let i = 0; i < appState.waypoints.length - 1; i++) {
        const fromWaypoint = appState.waypoints[i];
        const toWaypoint = appState.waypoints[i + 1];
        const flight = flightMap.findFlight(fromWaypoint.iata_code, toWaypoint.iata_code);
        if (flight) {
            appState.flights.push(flight);
            pathDrawing.createFlightPath(flight.originAirport, flight.destinationAirport, flight, 0);
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
    },

    setupMapEventListeners: function () {
        map.on('click', () => {
            pathDrawing.clearFlightPaths();
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
            if (event.target.id === 'flightPathToggle') {
                updateState('flightPathToggle', event.target.value);
                if (flightMap.selectedMarker) {
                    pathDrawing.drawFlightPaths(flightMap.selectedMarker);
                }
            }
        });

        document.addEventListener('click', function (event) {
            if (event.target.id === 'increaseTravelers') {
                updateState('numTravelers', appState.numTravelers + 1);
                flightList.updateTotalCost();
            } else if (event.target.id === 'decreaseTravelers' && appState.numTravelers > 1) {
                updateState('numTravelers', appState.numTravelers - 1);
                flightList.updateTotalCost();
            } else if (event.target.id === 'clearBtn') {
                flightList.clearFlightList();
                pathDrawing.clearFlightPaths();
            }
        });

        map.addEventListener('zoomChanged', function () {
            flightMap.updateMarkersForZoom();
        });
    },

    setupAllPathsButtonEventListener: function () {
        document.addEventListener('click', function (event) {
            if (event.target.id === 'allPathsBtn') {
                drawAllFlightPaths();
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

export { eventManager };

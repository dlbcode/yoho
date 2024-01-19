import { map, blueDotIcon, magentaDotIcon } from './map.js';
import { flightMap } from './flightMap.js';
import { routeList } from './routeList.js';
import { pathDrawing } from './pathDrawing.js';
import { drawAllRoutePaths } from './allPaths.js';
import { appState, updateState } from './stateManager.js';
import { setupAutocompleteForField } from './airportAutocomplete.js';

function handleStateChange(event) {
    const { key, value } = event.detail;

    if (key === 'addWaypoint' || key === 'removeWaypoint' || key === 'updateWaypoint') {
        const container = document.querySelector('.airport-selection');
        container.innerHTML = '';

        if (appState.waypoints.length === 2) {
            buildRouteDivs(1);
            addAddButton();
        } else {
            // Recreate route divs for more than two waypoints
            for (let i = 0; i < appState.waypoints.length; i += 2) {
                buildRouteDivs(i / 2 + 1);
            }
        }

        updateMarkerIcons();
        updateRoutesArray();
    }

    // Check if the number of waypoints is even and if the last waypoint field was just filled
    if (key === 'addWaypoint' && appState.waypoints.length % 2 === 0) {
        const lastWaypointFieldId = `waypoint${appState.waypoints.length}`;
        const lastWaypointField = document.getElementById(lastWaypointFieldId);

        // Check if the last waypoint field has a value (i.e., an airport selected)
        if (lastWaypointField && lastWaypointField.value) {
            // Add the 'Add' button only if it's not already present
            if (!document.getElementById('addRouteButton')) {
                addAddButton();
            }
        }
    }

    if (key === 'routeAdded') {
        buildRouteDivs(value.newRoute);
    }

    if (key === 'clearData') {
        const container = document.querySelector('.airport-selection');
        container.innerHTML = '';
        buildRouteDivs(1);
    }
    setFocusToNextUnsetInput();
}

function addAddButton() {
    const container = document.querySelector('.airport-selection');
    let addButton = document.createElement('button');
    addButton.textContent = 'Add';
    addButton.id = 'addRouteButton';
    addButton.addEventListener('click', handleAddButtonClick);
    container.appendChild(addButton);

    // Bring the 'Add' button into focus
    addButton.focus();
}

function handleAddButtonClick() {
    // Duplicate the last waypoint and create a new route div
    const lastWaypoint = appState.waypoints[appState.waypoints.length - 1];
    updateState('addWaypoint', lastWaypoint);
    const newRouteNumber = Math.ceil(appState.waypoints.length / 2);
    // buildRouteDivs(newRouteNumber);
    setFocusToNextUnsetInput();
}

function updateMarkerIcons() {
    const waypointIataCodes = new Set(appState.waypoints.map(waypoint => waypoint.iata_code));
    Object.entries(flightMap.markers).forEach(([iata, marker]) => {
        marker.setIcon(waypointIataCodes.has(iata) ? magentaDotIcon : blueDotIcon);
    });
}

async function updateRoutesArray() {
    let newRoutes = [];
    let fetchPromises = [];
  
    for (let i = 0; i < appState.waypoints.length - 1; i += 2) {
        const fromWaypoint = appState.waypoints[i];
        const toWaypoint = appState.waypoints[i + 1];
  
        // Fetch and cache routes if not already done
        if (!flightMap.directRoutes[fromWaypoint.iata_code]) {
            fetchPromises.push(flightMap.fetchAndCacheRoutes(fromWaypoint.iata_code));
        }
        if (!flightMap.directRoutes[toWaypoint.iata_code]) {
            fetchPromises.push(flightMap.fetchAndCacheRoutes(toWaypoint.iata_code));
        }
    }

    await Promise.all(fetchPromises);
  
    // Now find and add routes
    for (let i = 0; i < appState.waypoints.length - 1; i += 2) {
        const fromWaypoint = appState.waypoints[i];
        const toWaypoint = appState.waypoints[i + 1];
        let route = flightMap.findRoute(fromWaypoint.iata_code, toWaypoint.iata_code);
        if (route) {
            route.isDirect = true;
            newRoutes.push(route);
        } else {
            const indirectRoute = {
                originAirport: fromWaypoint,
                destinationAirport: toWaypoint,
                isDirect: false
            };
            newRoutes.push(indirectRoute);
        }
    }

    updateState('updateRoutes', newRoutes);
    pathDrawing.clearLines();
    pathDrawing.drawLines();
    routeList.updateTotalCost();
    console.table(appState.routes);
    document.dispatchEvent(new CustomEvent('routesArrayUpdated'));
}

function buildRouteDivs(routeNumber) {
    const container = document.querySelector('.airport-selection');
    const routeDivId = `route${routeNumber}`;
    let routeDiv = document.createElement('div');
    routeDiv.id = routeDivId;
    routeDiv.className = 'route-container';
    routeDiv.setAttribute('data-route-number', routeNumber.toString());

    // Create two waypoint input fields for the new route
    for (let i = 0; i < 2; i++) {
        let index = (routeNumber - 1) * 2 + i;
        let waypoint = appState.waypoints[index];
        let input = document.createElement('input');
        input.type = 'text';
        input.id = `waypoint${index + 1}`;
        input.placeholder = i === 0 ? 'Origin' : 'Destination';
        input.value = waypoint ? waypoint.iata_code : '';

        routeDiv.appendChild(input);

        const suggestionsDiv = document.createElement('div');
        suggestionsDiv.id = `waypoint${index + 1}Suggestions`;
        suggestionsDiv.className = 'suggestions';
        routeDiv.appendChild(suggestionsDiv);
    }

    // Add a minus button for each route div
    let minusButton = document.createElement('button');
    minusButton.textContent = '-';
    minusButton.className = 'remove-route-button';
    minusButton.onclick = () => removeRouteDiv(routeNumber);
    routeDiv.appendChild(minusButton);

    container.appendChild(routeDiv);

    for (let i = 0; i < 2; i++) {
        let index = (routeNumber - 1) * 2 + i;
        setupAutocompleteForField(`waypoint${index + 1}`);
    }
    setFocusToNextUnsetInput();
}

function removeRouteDiv(routeNumber) {
    let routeDiv = document.getElementById(`route${routeNumber}`);
    if (routeDiv) {
        routeDiv.remove();
    }

    console.log('removing waypoints for route ', routeNumber);
    updateState('removeWaypoints', { routeNumber: routeNumber });

    pathDrawing.clearLines();
    pathDrawing.drawLines();
    updateMarkerIcons();
    routeList.updateTotalCost();

    if (appState.waypoints.length > 1 && !document.getElementById('addRouteButton')) {
        addAddButton();
    }
}

function setFocusToNextUnsetInput() {
    const waypointInputs = document.querySelectorAll('.airport-selection input[type="text"]');
    requestAnimationFrame(() => {
        for (let input of waypointInputs) {
            if (!input.value) {
                input.focus();
                break;
            }
        }
    });
}

const eventManager = {
    setupEventListeners: function () {
        this.setupMapEventListeners();
        this.setupUIEventListeners();
        this.setupAllPathsButtonEventListener();
        document.addEventListener('stateChange', handleStateChange);
        document.addEventListener('routeAdded', function(event) {
            buildRouteDivs(event.detail.newRoute);
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
        document.querySelector('.airport-selection').addEventListener('click', function(event) {
            if (event.target.classList.contains('remove-route-button')) {
                const routeNumber = event.target.closest('.route-container').dataset.routeNumber;
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
                updateMarkerIcons();
                updateRoutesArray();
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
    flightMap.fetchAndDisplayAirports();
    eventManager.setupEventListeners();
});

export { eventManager };

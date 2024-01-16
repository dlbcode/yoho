import { map, blueDotIcon, magentaDotIcon } from './map.js';
import { flightMap } from './flightMap.js';
import { routeList } from './routeList.js';
import { pathDrawing } from './pathDrawing.js';
import { drawAllRoutePaths } from './allPaths.js';
import { appState, updateState } from './stateManager.js';

function handleStateChange(event) {
    const { key, value } = event.detail;

    if (key === 'addWaypoint' || key === 'removeWaypoint' || key === 'updateWaypoint') {
        const container = document.querySelector('.airport-selection'); // Clear existing waypoint fields
        container.innerHTML = '';

        appState.waypoints.forEach((waypoint, index) => { // Recreate waypoint fields based on the current waypoints
            let waypointField = createWaypointField(index + 1);
            waypointField.value = `${waypoint.iata_code}`;
        });

        updateMarkerIcons();
        createWaypointField(appState.waypoints.length + 1);
        updateRoutesArray();
    }

    if (key === 'routeAdded') {
        addRouteDiv(value.newRoute);
      }

    if (key === 'clearData') {
        // Clear existing waypoint fields
        const container = document.querySelector('.airport-selection');
        container.innerHTML = '';
        createWaypointField(1); // Create the first waypoint field
    }    
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
  
    for (let i = 0; i < appState.waypoints.length - 1; i++) {
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
  
    // Wait for all fetches to complete
    await Promise.all(fetchPromises);
  
    // Now find and add routes
    for (let i = 0; i < appState.waypoints.length - 1; i++) {
        const fromWaypoint = appState.waypoints[i];
        const toWaypoint =
        appState.waypoints[i + 1];
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

    // Update the routes in the state using the stateManager
    updateState('updateRoutes', newRoutes);

    // Additional UI updates and event dispatches as needed
    pathDrawing.clearLines();
    pathDrawing.drawLines();
    routeList.updateTotalCost();
    console.table(appState.routes);
    document.dispatchEvent(new CustomEvent('routesArrayUpdated'));
}

function addRouteDiv(newRoute) {
    const container = document.querySelector('.airport-selection');
    const routeDivId = `route${appState.routes.length + 1}`;
    let routeDiv = document.createElement('div');
    routeDiv.id = routeDivId;
    routeDiv.className = 'route-container';

    // Create two waypoint input fields for the new route
    for (let i = 0; i < 2; i++) {
        let input = document.createElement('input');
        input.type = 'text';
        input.id = `waypoint${appState.waypoints.length + i + 1}`;
        input.placeholder = i === 0 ? 'Origin' : 'Destination';
        routeDiv.appendChild(input);

        // Add suggestions div for each waypoint
        const suggestionsDiv = document.createElement('div');
        suggestionsDiv.id = `waypoint${appState.waypoints.length + i + 1}Suggestions`;
        suggestionsDiv.className = 'suggestions';
        routeDiv.appendChild(suggestionsDiv);
    }

    container.appendChild(routeDiv);
}

function createWaypointField(index) {
    const container = document.querySelector('.airport-selection');
    let routeDivId = `route${Math.ceil(index / 2)}`;
    let routeDiv = document.getElementById(routeDivId);

    // Create a new div for the route if it doesn't exist
    if (!routeDiv) {
        routeDiv = document.createElement('div');
        routeDiv.id = routeDivId;
        routeDiv.className = 'route-container'; 
        container.appendChild(routeDiv);

        // Set the default value for the first input of new route (except for the first route) to the value of the second input of the previous route
        if (index > 2) {
            const previousRouteLastInputId = `waypoint${index - 1}`;
            const previousRouteLastInput = document.getElementById(previousRouteLastInputId);
        if (previousRouteLastInput) {
            const defaultValue = previousRouteLastInput.value;
            const input = document.createElement('input');
            input.type = 'text';
            input.id = `waypoint${index}`;
            input.placeholder = 'Select Airport';
            input.value = defaultValue; // Set default value
            routeDiv.appendChild(input);
            const suggestionsDiv = document.createElement('div');
            suggestionsDiv.id = `waypoint${index}Suggestions`;
            suggestionsDiv.className = 'suggestions';
            routeDiv.appendChild(suggestionsDiv);

            // Emit custom event after creating a new waypoint field
            document.dispatchEvent(new CustomEvent('newWaypointField', { detail: { fieldId: input.id }            
        }));
            input.focus();
            return input;
        }
    }
}

// Create input field as usual if it's the first route or the second input of a route
const input = document.createElement('input');
input.type = 'text';
input.id = `waypoint${index}`;
input.placeholder = `Select Airport`;
routeDiv.appendChild(input);

const suggestionsDiv = document.createElement('div');
suggestionsDiv.id = `waypoint${index}Suggestions`;
suggestionsDiv.className = 'suggestions';
routeDiv.appendChild(suggestionsDiv);

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

        document.addEventListener('routeAdded', function(event) {
            addRouteDiv(event.detail.newRoute);
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

import { appState, updateState } from './stateManager.js';
import { setupAutocompleteForField } from './airportAutocomplete.js';
import { uiHandling } from './uiHandling.js';
import { flightMap } from './flightMap.js';
import { pathDrawing } from './pathDrawing.js';
import { routeList } from './routeList.js';
import { mapHandling } from './mapHandling.js';

const routeHandling = {

  buildRouteDivs: function(routeNumber) {
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
    minusButton.onclick = () => this.removeRouteDiv(routeNumber);
    routeDiv.appendChild(minusButton);

    container.appendChild(routeDiv);

    for (let i = 0; i < 2; i++) {
        let index = (routeNumber - 1) * 2 + i;
        setupAutocompleteForField(`waypoint${index + 1}`);
    }
    uiHandling.setFocusToNextUnsetInput();
  },

  removeRouteDiv: function(routeNumber) {
    let routeDiv = document.getElementById(`route${routeNumber}`);
    if (routeDiv) {
        routeDiv.remove();
    }

    console.log('removing waypoints for route ', routeNumber);
    updateState('removeWaypoints', { routeNumber: routeNumber });

    pathDrawing.clearLines();
    pathDrawing.drawLines();
    mapHandling.updateMarkerIcons();
    routeList.updateTotalCost();

    if (appState.waypoints.length > 1 && !document.getElementById('addRouteButton')) {
        uiHandling.addAddButton();
    }
  },

  updateRoutesArray: async function () {
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
}

export { routeHandling }
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
    
        // Determine the order of waypoints based on appState.routeDirection
        let waypointsOrder = [0, 1]; // Default order: Origin, Destination
        if (appState.routeDirection === 'to') {
            waypointsOrder = [1, 0]; // Reverse order for 'to' direction
        }
    
        // Create two waypoint input fields for the new route
        for (let i = 0; i < 2; i++) {
            let index = (routeNumber - 1) * 2 + waypointsOrder[i];
            let waypoint = appState.waypoints[index];
            let input = document.createElement('input');
            input.type = 'text';
            input.id = `waypoint${index + 1}`;
            input.placeholder = waypointsOrder[i] === 0 ? 'Origin' : 'Destination';
            input.value = waypoint ? waypoint.iata_code : '';
    
            routeDiv.appendChild(input);
    
            const suggestionsDiv = document.createElement('div');
            suggestionsDiv.id = `waypoint${index + 1}Suggestions`;
            suggestionsDiv.className = 'suggestions';
            routeDiv.appendChild(suggestionsDiv);
        }

    // Add a minus button for each route div
    if (routeNumber > 1) {
        let minusButton = document.createElement('button');
        minusButton.textContent = '-';
        minusButton.className = 'remove-route-button';
        minusButton.onclick = () => this.removeRouteDiv(routeNumber);
        routeDiv.appendChild(minusButton);
    }

    // Add event listeners to change the route line color on mouseover
    routeDiv.addEventListener('mouseover', () => {
        const routeId = this.getRouteIdFromDiv(routeDiv);
        const pathLines = pathDrawing.routePathCache[routeId] || pathDrawing.dashedRoutePathCache[routeId];
        if (pathLines && pathLines.length > 0) {
            routeDiv.dataset.originalColor = pathLines[0].options.color;
            pathLines.forEach(path => path.setStyle({ color: 'white'}));
        }
    });    

    routeDiv.addEventListener('mouseout', () => {
        const routeId = this.getRouteIdFromDiv(routeDiv);
        const pathLines = pathDrawing.routePathCache[routeId] || pathDrawing.dashedRoutePathCache[routeId];
        if (pathLines && pathLines.length > 0) {
            const originalColor = routeDiv.dataset.originalColor;
            pathLines.forEach(path => path.setStyle({ color: originalColor }));
        }
        pathDrawing.clearLines();
        pathDrawing.drawLines();
    });    

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

    updateState('removeWaypoints', { routeNumber: routeNumber });

    pathDrawing.clearLines();
    pathDrawing.drawLines();
    mapHandling.updateMarkerIcons();
    routeList.updateTotalCost();

    if (appState.waypoints.length > 1 && !document.getElementById('addRouteButton')) {
        uiHandling.addAddButton();
    }
  },

  getRouteIdFromDiv: function (routeDiv) {
    const inputs = routeDiv.querySelectorAll('input[type="text"]');
    if (inputs.length === 2) {
        const originIata = inputs[0].value; // IATA code of the origin
        const destinationIata = inputs[1].value; // IATA code of the destination
        return `${originIata}-${destinationIata}`; // Concatenate to form the route ID
    }
    return null; // Return null if the route ID cannot be determined
},

  updateRoutesArray: async function () {
    let newRoutes = [];
    let fetchPromises = [];

    for (let i = 0; i < appState.waypoints.length - 1; i += 2) {
        const fromWaypoint = appState.waypoints[i];
        const toWaypoint = appState.waypoints[i + 1];

        // Fetch and cache routes if not already done
        if (!appState.directRoutes[fromWaypoint.iata_code]) {
            fetchPromises.push(flightMap.fetchAndCacheRoutes(fromWaypoint.iata_code));
        }
        if (!appState.directRoutes[toWaypoint.iata_code]) {
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
import { appState, updateState } from '../stateManager.js';
import { pathDrawing } from '../pathDrawing.js';
import { mapHandling } from '../mapHandling.js';
import { routeHandling } from '../routeHandling.js';
import { lineManager } from '../lineManager.js';

const removeRoute = (routeNumber) => {
    let selectedRouteIndex = routeNumber;
    let groupNumber = appState.selectedRoutes[selectedRouteIndex]?.group;

    // Clear all lines associated with this route
    lineManager.clearLinesByRouteNumber(routeNumber);

    // Remove selectedRoutes with same group number
    Object.keys(appState.selectedRoutes).forEach(key => {
        if (appState.selectedRoutes[key].group === groupNumber) {
            updateState('removeSelectedRoute', parseInt(key), 'removeRoute.removeRouteButton2');
        }
    });

    // Remove waypoints
    updateState('removeWaypoints', { routeNumber }, 'removeRoute.removeRouteButton2');

    // Remove route date
    delete appState.routeDates[routeNumber];

    // Re-index routeDates
    const newRouteDates = {};
    Object.keys(appState.routeDates).forEach(key => {
        if (parseInt(key) < routeNumber) {
            newRouteDates[key] = appState.routeDates[key];
        } else if (parseInt(key) > routeNumber) {
            newRouteDates[parseInt(key) - 1] = appState.routeDates[key];
        }
    });
    appState.routeDates = newRouteDates;

    // Update map
    mapHandling.updateMarkerIcons();
    routeHandling.updateRoutesArray();
    
    // Close route box
    document.getElementById('routeBox').style.display = 'none';
};

const removeRouteButton = (container, routeNumber) => {
    const removeButton = document.createElement('button');
    removeButton.textContent = 'Remove';
    removeButton.className = 'remove-button';
    removeButton.dataset.routeNumber = routeNumber;
    removeButton.onclick = () => removeRoute(routeNumber);
    if (container instanceof HTMLElement) {
        container.appendChild(removeButton);
    } else {
        console.error('Invalid routeBox element provided');
    }
};

export { removeRouteButton, removeRoute };

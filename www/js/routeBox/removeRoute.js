import { appState, updateState } from '../stateManager.js';
import { mapHandling } from '../mapHandling.js';
import { routeHandling } from '../routeHandling.js';
import { lineManager } from '../lineManager.js';
import { adjustMapSize } from '../map.js';

const removeRoute = (routeNumber) => {
    let selectedRouteIndex = routeNumber;
    let groupNumber = appState.selectedRoutes[selectedRouteIndex]?.group;

    // Clear lines first
    if (groupNumber !== undefined) {
        lineManager.clearLinesByTags([`group:${groupNumber}`]);
    } else {
        lineManager.clearLines('route', routeNumber);
    }

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

    // Update map
    mapHandling.updateMarkerIcons();
    routeHandling.updateRoutesArray();
    
    // Close route box
    document.getElementById('routeBox').style.display = 'none';

    // Collapse infoPane to initial state
    const infoPane = document.getElementById('infoPane');
    if (infoPane) {
        infoPane.style.height = '40px'; // This is the default height with just the menu bar
        const infoPaneContent = document.getElementById('infoPaneContent');
        if (infoPaneContent) {
            infoPaneContent.innerHTML = ''; // Clear the content
        }
        adjustMapSize();
    }
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

import { appState } from './stateManager.js';
import { routeHandling } from './routeHandling.js';

const routeBox = {
    openRouteSelection: function() {
      console.log('openRouteSelection');
        const routeIndex = appState.currentRouteIndex;
        routeHandling.buildRouteDivs(routeIndex);
        this.displayRouteBox(routeIndex);
    },

    displayRouteBox: function(routeIndex) {
        const routeDivId = `route${routeIndex}`;
        const routeDiv = document.getElementById(routeDivId);
        if (routeDiv) {
            routeDiv.style.display = 'block'; // Make sure the route box is visible
            document.body.appendChild(routeDiv); // Optionally, move the route box to a more prominent location
        }
    }
};

export { routeBox };

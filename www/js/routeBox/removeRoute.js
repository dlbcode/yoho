import { appState, updateState } from '../stateManager.js';
import { pathDrawing } from '../pathDrawing.js';
import { mapHandling } from '../mapHandling.js';
import { routeHandling } from '../routeHandling.js';

const removeRoute = (routeNumber) => {
  let selectedRouteIndex = routeNumber;
  let groupNumber = appState.selectedRoutes[selectedRouteIndex]?.group;

  // Remove all selectedRoutes with the same group number
  Object.keys(appState.selectedRoutes).forEach(key => {
      if (appState.selectedRoutes[key].group === groupNumber) {
          updateState('removeSelectedRoute', parseInt(key), 'removeRoute.removeRouteButton2');
      }
  });

  // Remove the waypoints associated with the route
  updateState('removeWaypoints', { routeNumber }, 'removeRoute.removeRouteButton2');

  // Remove the route date for the removed route
  delete appState.routeDates[routeNumber];

  // Re-index routeDates to fill the gap left by the removed route
  const newRouteDates = {};
  Object.keys(appState.routeDates).forEach((key, index) => {
      if (parseInt(key) < routeNumber) {
          newRouteDates[key] = appState.routeDates[key];
      } else if (parseInt(key) > routeNumber) {
          // Shift the dates down to fill the gap left by the removed route
          newRouteDates[parseInt(key) - 1] = appState.routeDates[key];
      }
  });
  appState.routeDates = newRouteDates;

  // Additional logic to update the UI and application state as needed
  pathDrawing.clearLines(true);

  // Remove decorated lines for the specific route
  pathDrawing.decoratedLines = [];
  //pathDrawing.decoratedLines = pathDrawing.decoratedLines.filter(line => {
  //    if (line.routeId === routeNumber) {
  //        if (map.hasLayer(line)) {
  //            map.removeLayer(line);
  //        }
  //        return false; // Remove this line from the array
  //    }
  //    return true;
  //});

  pathDrawing.drawLines();
  mapHandling.updateMarkerIcons();
  routeHandling.updateRoutesArray();

  // Close the route box after operation
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

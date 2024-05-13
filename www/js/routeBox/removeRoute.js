import { appState, updateState } from '../stateManager.js';
import { pathDrawing } from '../pathDrawing.js';
import { routeList } from '../routeList.js';
import { mapHandling } from '../mapHandling.js';
import { routeHandling } from '../routeHandling.js';

export function removeRouteButton(container, routeNumber) {
  const removeButton = document.createElement('button');
  removeButton.textContent = 'Remove';
  removeButton.className = 'remove-button';
  removeButton.onclick = function() {
      //let routeNumber = appState.currentRouteIndex;  // Assuming this is how you track the current route index

      // Calculate the index for selectedRoutes based on the routeNumber
      let selectedRouteIndex = routeNumber;
      let groupNumber = appState.selectedRoutes[selectedRouteIndex]?.group;

      // Remove all selectedRoutes with the same group number
      Object.keys(appState.selectedRoutes).forEach(key => {
          if (appState.selectedRoutes[key].group === groupNumber) {
              updateState('removeSelectedRoute', parseInt(key));
          }
      });

      // Remove the waypoints for the route being removed
      let waypointsIndex = (routeNumber) * 2;
      if (appState.waypoints.length > waypointsIndex) {
          appState.waypoints.splice(waypointsIndex, 2); // Remove 2 waypoints starting from the calculated index
          updateState('updateWaypoint', appState.waypoints); // Update the state to reflect the change
      }

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
      pathDrawing.drawLines();
      mapHandling.updateMarkerIcons();
      routeList.updateEstPrice();
      routeHandling.updateRoutesArray();

      // Close the route box after operation
      document.getElementById('routeBox').style.display = 'none';
  };
  if (routeBox instanceof HTMLElement) {
    container.appendChild(removeButton);
  } else {
    console.error('Invalid routeBox element provided');
  }
}
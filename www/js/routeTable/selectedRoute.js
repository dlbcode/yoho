import { appState, updateState } from '../stateManager.js';

const selectedRoute = {
  displaySelectedRouteInfo(routeIndex) {
    console.log('Displaying selected route info for route index:', routeIndex);
    const selectedRouteDetails = appState.selectedRoutes[routeIndex];
    console.log(appState.selectedRoutes[routeIndex]);
    console.log('Selected route details:', selectedRouteDetails);
    if (!selectedRouteDetails) {
      console.error('Selected route details are undefined or null');
      return;
    }

    const infoPaneContent = document.getElementById('infoPaneContent');
    infoPaneContent.innerHTML = ''; // Clear current content

    // Create and append the 'Change Route' button
    const changeRouteButton = document.createElement('button');
    changeRouteButton.textContent = 'Change Route';
    changeRouteButton.onclick = () => {
      updateState('removeSelectedRoute', routeIndex);
      // Trigger a state change to refresh the info pane
      document.dispatchEvent(new CustomEvent('stateChange', { detail: { key: 'removeSelectedRoute', routeIndex } }));
    };
    infoPaneContent.appendChild(changeRouteButton);

    // Display selected route details
    const detailsList = document.createElement('ul');
    // Adjusted to directly iterate over selectedRouteDetails
    Object.entries(selectedRouteDetails).forEach(([key, value]) => {
      // Skip displaying the deep_link or any other non-display properties
      if (key !== 'deep_link') {
        const listItem = document.createElement('li');
        listItem.textContent = `${key}: ${value}`;
        detailsList.appendChild(listItem);
      }
    });
    infoPaneContent.appendChild(detailsList);
  }
};

export { selectedRoute };

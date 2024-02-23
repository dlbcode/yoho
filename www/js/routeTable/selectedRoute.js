import { appState } from '../stateManager.js';

const selectedRoute = {
  displaySelectedRouteInfo(routeIndex) {
    const selectedRouteDetails = appState.selectedRoutes[routeIndex];
    if (!selectedRouteDetails) {
      console.error('Selected route details are undefined or null');
      return;
    }

    const infoPaneContent = document.getElementById('infoPaneContent');
    infoPaneContent.innerHTML = '';

    // Create and append the 'Change Route' button
    const changeRouteButton = document.createElement('button');
    changeRouteButton.textContent = 'Change Route';
    changeRouteButton.onclick = () => {
      // Logic to switch back to the route table view
    };
    infoPaneContent.appendChild(changeRouteButton);

    // Find the route segment in fullData.route that matches the selected route ID
    const routeSegment = selectedRouteDetails.fullData.route.find(segment => segment.id === selectedRouteDetails.id);
    if (!routeSegment) {
      console.error('Matching route segment not found');
      return;
    }

    // Display details for the matching route segment
    const detailsList = document.createElement('ul');
    Object.entries(routeSegment).forEach(([key, value]) => {
      const listItem = document.createElement('li');
      listItem.textContent = `${key}: ${value}`;
      detailsList.appendChild(listItem);
    });
    infoPaneContent.appendChild(detailsList);
  }
};

export { selectedRoute };

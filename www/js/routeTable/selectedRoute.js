import { appState, updateState } from '../stateManager.js';

const selectedRoute = {
  displaySelectedRouteInfo(routeIndex) {
    const selectedRouteDetails = appState.selectedRoutes[routeIndex];
    if (!selectedRouteDetails) {
      return;
    }

    const infoPaneContent = document.getElementById('infoPaneContent');
    infoPaneContent.innerHTML = '';

    // Create and append the 'Change Route' button
    const changeRouteButton = document.createElement('button');
    changeRouteButton.textContent = 'Change Route';
    changeRouteButton.onclick = () => {
      appState.currentView = 'routeTable';
      appState.currentRouteIndex = routeIndex;
      console.log('changeRouteButton: routeIndex:', routeIndex);
      document.dispatchEvent(new CustomEvent('stateChange', { detail: { key: 'changeView', value: 'routeTable' } }));
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
import { appState, updateState } from '../stateManager.js';

const selectedRoute = {
  displaySelectedRouteInfo: function(routeIndex) {
    const selectedRouteDetails = appState.selectedRoutes[String(routeIndex)];

    if (!selectedRouteDetails) {
        console.error(`Selected route details not found for routeIndex: ${routeIndex}`);
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
      document.dispatchEvent(new CustomEvent('stateChange', { detail: { key: 'changeView', value: 'routeTable' } }));
    };
    infoPaneContent.appendChild(changeRouteButton);

    // Directly use fullData for displaying route information
    const routeData = selectedRouteDetails.fullData;

    // Display details for the route
    const detailsList = document.createElement('ul');
    Object.entries(routeData).forEach(([key, value]) => {
        // Filter out non-stringifiable values or properties not intended for display
        if (typeof value === 'string' || typeof value === 'number') {
            const listItem = document.createElement('li');
            listItem.textContent = `${key}: ${value}`;
            detailsList.appendChild(listItem);
        }
    });
    infoPaneContent.appendChild(detailsList);
    console.log('routeDates: ',appState.routeDates);
}

};

export { selectedRoute };
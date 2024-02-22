import { appState, updateState } from '../stateManager.js';

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
      appState.currentView = 'routeTable';
      appState.currentRouteIndex = routeIndex;
      document.dispatchEvent(new CustomEvent('stateChange', { detail: { key: 'changeView', value: 'routeTable' } }));
    };
    infoPaneContent.appendChild(changeRouteButton);

    // Display all details of the selected route
    const detailsList = document.createElement('ul');
    Object.entries(selectedRouteDetails).forEach(([key, value]) => {
      // For nested objects like countryFrom, countryTo, duration, etc., handle them separately
      if (typeof value === 'object' && value !== null) {
        Object.entries(value).forEach(([nestedKey, nestedValue]) => {
          const listItem = document.createElement('li');
          listItem.textContent = `${key} ${nestedKey}: ${nestedValue}`;
          detailsList.appendChild(listItem);
        });
      } else {
        const listItem = document.createElement('li');
        listItem.textContent = `${key}: ${value}`;
        detailsList.appendChild(listItem);
      }
    });
    infoPaneContent.appendChild(detailsList);
  }
};

export { selectedRoute };
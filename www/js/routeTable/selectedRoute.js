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

    const changeRouteButton = document.createElement('button');
    changeRouteButton.textContent = 'Change Route';
    changeRouteButton.onclick = () => {
      appState.currentView = 'routeTable';
      appState.currentRouteIndex = routeIndex;
      document.dispatchEvent(new CustomEvent('stateChange', { detail: { key: 'changeView', value: 'routeTable' } }));
    };
    infoPaneContent.appendChild(changeRouteButton);

    const detailsList = document.createElement('ul');
    Object.entries(selectedRouteDetails).forEach(([key, value]) => {
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

import { appState, updateState } from '../stateManager.js';
import { setupRouteContent } from '../infoPane.js';

const selectedRoute = {
    displaySelectedRouteInfo: function(routeIndex) {
        const selectedRouteDetails = appState.selectedRoutes[String(routeIndex)];

        if (!selectedRouteDetails) {
            console.error(`Selected route details not found for routeIndex: ${routeIndex}`);
            return;
        }

        // Use setupRouteContent to create consistent structure
        const { contentWrapper } = setupRouteContent(routeIndex);

        // Add change route button in a consistent location
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'button-container';
        
        const changeRouteButton = document.createElement('button');
        changeRouteButton.textContent = 'Change Route';
        changeRouteButton.className = 'change-route-button';
        changeRouteButton.onclick = () => {
            appState.currentView = 'routeTable';
            appState.currentRouteIndex = routeIndex;
            document.dispatchEvent(new CustomEvent('stateChange', { 
                detail: { key: 'changeView', value: 'routeTable' } 
            }));
        };
        buttonContainer.appendChild(changeRouteButton);
        contentWrapper.appendChild(buttonContainer);

        // Add route details
        const detailsContainer = document.createElement('div');
        detailsContainer.className = 'route-details-container';

        // Display route data
        if (selectedRouteDetails.fullData) {
            Object.entries(selectedRouteDetails.fullData)
                .filter(([key, value]) => 
                    typeof value === 'string' || 
                    typeof value === 'number')
                .forEach(([key, value]) => {
                    const detail = document.createElement('div');
                    detail.className = 'route-detail-item';
                    detail.textContent = `${key}: ${value}`;
                    detailsContainer.appendChild(detail);
                });
        }

        contentWrapper.appendChild(detailsContainer);
    }
};

export { selectedRoute };
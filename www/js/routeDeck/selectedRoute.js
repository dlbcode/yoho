import { appState, updateState } from '../stateManager.js';
import { infoPaneHeight } from '../utils/infoPaneHeightManager.js';

const selectedRoute = {
    displaySelectedRouteInfo: function(routeIndex) {
        const selectedRouteDetails = appState.selectedRoutes[String(routeIndex)];

        if (!selectedRouteDetails) {
            console.error(`Selected route details not found for routeIndex: ${routeIndex}`);
            return;
        }

        // Clear existing content first
        const infoPaneContent = document.getElementById('infoPaneContent');
        infoPaneContent.innerHTML = '';

        // Create content wrapper directly without using setupRouteContent
        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'content-wrapper';
        infoPaneContent.appendChild(contentWrapper);

        // Add change route button in a consistent location
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'button-container';
        
        const changeRouteButton = document.createElement('button');
        changeRouteButton.textContent = 'Change Route';
        changeRouteButton.className = 'change-route-button';
        changeRouteButton.onclick = () => {
            appState.currentView = 'routeDeck';
            appState.currentRouteIndex = routeIndex;
            document.dispatchEvent(new CustomEvent('stateChange', { 
                detail: { key: 'changeView', value: 'routeDeck' } 
            }));
        };
        buttonContainer.appendChild(changeRouteButton);
        contentWrapper.appendChild(buttonContainer);

        // Add route details
        const detailsContainer = document.createElement('div');
        detailsContainer.className = 'selected-route-container';
        
        // Create a nice display of the route information
        const routeDetails = selectedRouteDetails.displayData;
        
        detailsContainer.innerHTML = `
            <div class="selected-route-header">
                <h2>${routeDetails.route}</h2>
                <div class="selected-route-price">$${routeDetails.price}</div>
            </div>
            <div class="selected-route-info">
                <div class="info-row">
                    <div class="info-label">Departure:</div>
                    <div class="info-value">${new Date(routeDetails.departure).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
                </div>
                <div class="info-row">
                    <div class="info-label">Airline:</div>
                    <div class="info-value">${routeDetails.airline}</div>
                </div>
                <div class="info-row">
                    <div class="info-label">Book here:</div>
                    <div class="info-value"><a href="${routeDetails.deep_link}" target="_blank" class="booking-link">Book Flight</a></div>
                </div>
            </div>
        `;
        
        contentWrapper.appendChild(detailsContainer);
        
        // Make sure infoPane is expanded
        const infoPane = document.getElementById('infoPane');
        infoPane.classList.remove('collapsed');
        infoPane.classList.add('expanded');
        
        // Set the appropriate info pane height
        infoPaneHeight.setHeight('content', {
            contentElement: detailsContainer,
            contentHeight: detailsContainer.offsetHeight + infoPaneHeight.MENU_BAR_HEIGHT + 20
        });
        
        // Update current view and route index
        appState.currentView = 'selectedRoute';
        appState.currentRouteIndex = routeIndex;
    }
};

export { selectedRoute };
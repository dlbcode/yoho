import { inputManager } from '../inputManager.js';

export const domManager = {
    setupBaseStructure(routeIndex) {
        const infoPaneContent = document.getElementById('infoPaneContent');
        infoPaneContent.innerHTML = '';

        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'content-wrapper';

        const routeBoxContainer = document.createElement('div');
        routeBoxContainer.id = 'routeBoxContainer';

        const routeBoxElement = routeBox.createRouteBox();
        routeBoxElement.id = 'routeBox';
        routeBoxElement.dataset.routeNumber = routeIndex;

        routeBoxContainer.appendChild(routeBoxElement);
        contentWrapper.appendChild(routeBoxContainer);
        infoPaneContent.appendChild(contentWrapper);

        routeBox.setupRouteBox(routeBoxElement, routeIndex);

        return { contentWrapper, routeBoxContainer, routeBoxElement };
    },

    clearRouteBox() {
        const existingRouteBox = document.getElementById('routeBox');
        if (existingRouteBox) {
            existingRouteBox.remove();
        }
    },

    preserveRouteBox(contentWrapper) {
        const existingRouteBox = contentWrapper.querySelector('#routeBox');
        contentWrapper.innerHTML = '';
        if (existingRouteBox) {
            contentWrapper.appendChild(existingRouteBox);
        }
        return existingRouteBox;
    },

    removeRouteStructure(routeNumber) {
        // First, collect all waypoint input IDs associated with this route for later cleanup
        const inputsToCleanup = [];
        
        // Calculate input field IDs based on routeNumber
        const originInputId = `waypoint-input-${routeNumber * 2 + 1}`;
        const destInputId = `waypoint-input-${routeNumber * 2 + 2}`;
        
        // Add them to the cleanup list if they exist
        const originInput = document.getElementById(originInputId);
        const destInput = document.getElementById(destInputId);
        
        if (originInput) inputsToCleanup.push(originInputId);
        if (destInput) inputsToCleanup.push(destInputId);
        
        // Remove the route box content
        const routeBox = document.querySelector(`.route-box[data-route-number="${routeNumber}"]`);
        if (routeBox) {
            routeBox.innerHTML = '';
            routeBox.remove();
        }
        
        // Perform cleanup for each input field
        inputsToCleanup.forEach(inputId => {
            // Clean up suggestion boxes and input states
            inputManager.cleanupInput(inputId);
        });
        
        console.log(`Removed DOM structure for route ${routeNumber}`);
    }
};
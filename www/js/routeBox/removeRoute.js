import { appState, updateState } from '../stateManager.js';
import { mapHandling } from '../mapHandling.js';
import { routeHandling } from '../routeHandling.js';
import { lineManager } from '../lineManager.js';
import { adjustMapSize } from '../map.js';
import { setupRouteContent } from '../infoPane.js';
import { domManager } from '../utils/domManager.js';
import { infoPane } from '../infoPane.js';
import { infoPaneHeight } from '../utils/infoPaneHeightManager.js';
import { showRouteRemovalModal } from './routeRemovalModal.js';
import { inputManager } from '../inputManager.js'; // Add this import to fix the reference error

const removeRoute = (routeNumber) => {
    // Get the infoPane element before removing content
    const infoPaneElement = document.getElementById('infoPane');
    
    console.log(`Removing route ${routeNumber}`);
    
    let groupNumber = appState.selectedRoutes[routeNumber]?.group;

    // Get a list of all input ids before removal for later cleanup
    const inputsToCleanup = Array.from(document.querySelectorAll('.waypoint-input'))
        .filter(input => input.id && input.id.startsWith(`waypoint-input-`))
        .map(input => input.id);

    // Remove DOM structure first
    domManager.removeRouteStructure(routeNumber);

    // Collapse the info pane
    if (infoPaneElement) {
        infoPaneHeight.toggleInfoPaneHeight(infoPaneElement, true);
    }

    // Clear cached route deck
    infoPane.routeDecks.delete(routeNumber);

    // Clear lines
    if (groupNumber !== undefined) {
        lineManager.clearLinesByTags([`group:${groupNumber}`]);
    } else {
        lineManager.clearLines('route', routeNumber);
    }

    // Remove selected route 
    if (appState.selectedRoutes[routeNumber]) {
        if (groupNumber) {
            // Remove all routes in the group
            Object.keys(appState.selectedRoutes).forEach(key => {
                if (appState.selectedRoutes[key].group === groupNumber) {
                    updateState('removeSelectedRoute', parseInt(key), 'removeRoute');
                }
            });
        } else {
            updateState('removeSelectedRoute', routeNumber, 'removeRoute');
        }
    }

    // Critical fix: Make a backup of the route data before removal
    const routeBeforeRemoval = { ...appState.routeData[routeNumber] };
    console.log(`Route ${routeNumber} data before removal:`, routeBeforeRemoval);

    // Completely remove the route data
    delete appState.routeData[routeNumber];
    
    // No need to update legacy waypoints, just notify state manager of the change
    updateState('removeWaypoints', { routeNumber }, 'removeRoute');

    // Setup next view
    if (appState.currentView === 'routeDeck' && appState.currentRouteIndex === routeNumber) {
        const prevRouteIndex = routeNumber - 1;
        if (prevRouteIndex >= 0) {
            setupRouteContent(prevRouteIndex);
            if (appState.selectedRoutes[prevRouteIndex]) {
                appState.currentView = 'selectedRoute';
                appState.currentRouteIndex = prevRouteIndex;
            } else {
                appState.currentView = 'trip';
            }
        } else {
            setupRouteContent(0);
            appState.currentView = 'trip';
        }
    }

    mapHandling.updateMarkerIcons();
    routeHandling.updateRoutesArray();
    adjustMapSize();
    
    // Force URL update using routeData only
    updateState('updateRoutes', appState.routeData.filter(route => route && !route.isEmpty), 'removeRoute');

    // Force route buttons update
    setTimeout(() => {
        import('../infoPane.js').then(({ infoPane }) => {
            infoPane.updateRouteButtons();
        });
    }, 50);

    // After route removal and view setup, clean up suggestion boxes and reposition any remaining ones
    setTimeout(() => {
        Object.keys(inputManager.suggestionBoxes).forEach(id => {
            const input = document.getElementById(id);
            if (input && document.body.contains(input)) {
                inputManager.positionSuggestionBox(id);
            } else if (inputManager.suggestionBoxes[id]) {
                // Remove orphaned suggestion boxes
                const box = inputManager.suggestionBoxes[id];
                if (box && document.body.contains(box)) {
                    box.remove();
                }
                delete inputManager.suggestionBoxes[id];
                delete inputManager.inputStates[id];
            }
        });
    }, 100);
};

// Updated to use modal for selected routes
const removeRouteButton = (container, routeNumber) => {
    const removeButton = document.createElement('button');
    removeButton.className = 'remove-button';
    removeButton.dataset.routeNumber = routeNumber;
    
    // Update the click handler to check if this is a selected route
    removeButton.onclick = () => {
        // Check if this is a selected route with a group
        const isSelectedRoute = appState.selectedRoutes[routeNumber] !== undefined;
        const groupNumber = appState.selectedRoutes[routeNumber]?.group;
        const hasMultipleSegments = isSelectedRoute && 
            Object.values(appState.selectedRoutes).filter(route => route.group === groupNumber).length > 1;
        
        if (isSelectedRoute && hasMultipleSegments) {
            // Show the removal modal for selected routes with multiple segments
            showRouteRemovalModal(routeNumber);
        } else {
            // Perform direct removal for non-selected routes or single-segment routes
            removeRoute(routeNumber);
        }
    };
    
    removeButton.innerHTML = `<img src="./assets/trash_icon.svg" alt="Remove" style="width: 20px; height: 20px;">`; // Use trash icon
    if (container instanceof HTMLElement) {
        container.appendChild(removeButton);
    } else {
        console.error('Invalid routeBox element provided');
    }
};

export { removeRouteButton, removeRoute };

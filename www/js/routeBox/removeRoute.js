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
import { inputManager } from '../inputManager.js';

const removeRoute = (routeNumber) => {
    // Get the infoPane element before removing content
    const infoPaneElement = document.getElementById('infoPane');
    
    console.log(`Removing route ${routeNumber}`);
    
    // Get the group ID from routeData instead of selectedRoutes
    let groupNumber = appState.routeData[routeNumber]?.selectedRoute?.group;

    // Get a list of all input ids before removal for later cleanup
    const inputsToCleanup = Array.from(document.querySelectorAll('.waypoint-input'))
        .filter(input => input.id && input.id.startsWith(`waypoint-input-`))
        .map(input => input.id);
    
    // Store route-specific input IDs for cleanup
    const routeSpecificInputIds = [
        `waypoint-input-${routeNumber * 2 + 1}`,
        `waypoint-input-${routeNumber * 2 + 2}`
    ];

    // First, do immediate cleanup of the route's suggestion boxes
    routeSpecificInputIds.forEach(id => {
        if (inputManager.suggestionBoxes[id]) {
            const box = inputManager.suggestionBoxes[id];
            if (box && document.body.contains(box)) {
                box.remove();
            }
            delete inputManager.suggestionBoxes[id];
            delete inputManager.inputStates[id];
        }
    });

    // Remove DOM structure
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

    // Remove selected route - update to use routeData
    if (appState.routeData[routeNumber]?.selectedRoute) {
        if (groupNumber) {
            // Remove all routes in the group
            Object.keys(appState.routeData).forEach(key => {
                const routeData = appState.routeData[key];
                if (routeData?.selectedRoute?.group === groupNumber) {
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

    // Use routeData exclusively for removing routes
    updateState('removeRoute', { routeNumber }, 'removeRoute');

    // Setup next view
    if (appState.currentView === 'routeDeck' && appState.currentRouteIndex === routeNumber) {
        const prevRouteIndex = routeNumber - 1;
        if (prevRouteIndex >= 0) {
            setupRouteContent(prevRouteIndex);
            if (appState.routeData[prevRouteIndex]?.selectedRoute) {
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
    // Fix the formatting of the routes to prevent [object Object] in buttons
    const formattedRoutes = appState.routeData
        .filter(route => route && !route.isEmpty)
        .map(route => ({
            tripType: route.tripType,
            travelers: route.travelers,
            origin: route.origin?.iata_code || null,
            destination: route.destination?.iata_code || null,
            price: route.price,
            isDirect: route.isDirect,
            isSelected: route.isSelected
        }));
    
    updateState('updateRoutes', formattedRoutes, 'removeRoute');

    // Force route buttons update
    setTimeout(() => {
        import('../infoPane.js').then(({ infoPane }) => {
            infoPane.updateRouteButtons();
        });
    }, 50);

    // After route removal and view setup, reposition remaining suggestion boxes with a more comprehensive cleanup
    setTimeout(() => {
        // First, do a comprehensive cleanup of stale suggestion boxes
        Object.keys(inputManager.suggestionBoxes).forEach(id => {
            const input = document.getElementById(id);
            if (!input || !document.body.contains(input)) {
                // Remove orphaned suggestion boxes
                const box = inputManager.suggestionBoxes[id];
                if (box && document.body.contains(box)) {
                    box.remove();
                }
                delete inputManager.suggestionBoxes[id];
                delete inputManager.inputStates[id];
            }
        });
        
        // Then position only the suggestion boxes for inputs that still exist
        Object.keys(inputManager.suggestionBoxes).forEach(id => {
            const input = document.getElementById(id);
            if (input && document.body.contains(input)) {
                inputManager.positionSuggestionBox(id);
            }
        });
    }, 200); // Increased timeout to ensure DOM is stable
};

// Updated to use modal for selected routes
const removeRouteButton = (container, routeNumber) => {
    const removeButton = document.createElement('button');
    removeButton.className = 'remove-button';
    removeButton.dataset.routeNumber = routeNumber;
    
    // Update the click handler to check if this is a selected route
    removeButton.onclick = () => {
        // Add debug logging to see what's happening
        console.log(`Remove button clicked for route ${routeNumber}`);
        console.log(`Route data:`, appState.routeData[routeNumber]);
        
        // Check if this is a selected route with a group - use routeData instead of selectedRoutes
        const selectedRouteData = appState.routeData[routeNumber]?.selectedRoute;
        const isSelectedRoute = selectedRouteData !== undefined;
        const groupNumber = selectedRouteData?.group;
        
        console.log(`Is selected route: ${isSelectedRoute}, Group number: ${groupNumber}`);
        
        // Nothing happens if there's no group, so make sure we check for that
        if (!isSelectedRoute || groupNumber === undefined) {
            console.log(`Route ${routeNumber} is not a selected route or has no group, removing directly`);
            removeRoute(routeNumber);
            return;
        }
        
        // Check for multiple segments using routeData - with clearer logging
        const groupSegments = Object.entries(appState.routeData)
            .filter(([_, route]) => {
                const isInGroup = route?.selectedRoute?.group === groupNumber;
                if (isInGroup) {
                    console.log(`Found route in group ${groupNumber}:`, route);
                }
                return isInGroup;
            });
            
        const hasMultipleSegments = groupSegments.length > 1;
        
        console.log(`Group ${groupNumber} has ${groupSegments.length} segments`);
        
        if (hasMultipleSegments) {
            // Show the removal modal for selected routes with multiple segments
            console.log(`Showing removal modal for route ${routeNumber} in group ${groupNumber}`);
            showRouteRemovalModal(routeNumber);
        } else {
            // Perform direct removal for non-selected routes or single-segment routes
            console.log(`Removing route ${routeNumber} directly (single segment or no group)`);
            removeRoute(routeNumber);
        }
    };
    
    removeButton.innerHTML = `<img src="./assets/trash_icon.svg" alt="Remove" style="width: 20px; height: 20px;">`;
    if (container instanceof HTMLElement) {
        container.appendChild(removeButton);
    } else {
        console.error('Invalid routeBox element provided');
    }
};

export { removeRouteButton, removeRoute };

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

    // CRITICAL FIX: Remove all suggestion boxes BEFORE DOM changes
    // This prevents orphaned elements and incorrect positioning
    if (inputManager.recreateSuggestionBoxes) {
        // First completely remove all suggestion boxes
        Object.keys(inputManager.suggestionBoxes).forEach(id => {
            const box = inputManager.suggestionBoxes[id];
            if (box && document.body.contains(box)) {
                box.remove();
            }
        });
        inputManager.suggestionBoxes = {};
    }

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
    import('../infoPane.js').then(({ infoPane }) => {
        infoPane.updateRouteButtons();
        
        // CRITICAL FIX: Recreate suggestion boxes AFTER all DOM updates are done
        if (inputManager.recreateSuggestionBoxes) {
            console.log('Recreating suggestion boxes after route removal');
            inputManager.recreateSuggestionBoxes();
        }
    });
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

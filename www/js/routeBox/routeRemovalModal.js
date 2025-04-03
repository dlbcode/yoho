import { appState } from '../stateManager.js';
import { removeRoute } from './removeRoute.js';

// Load CSS with the correct path - no need to add if already exists
(function loadModalCSS() {
    // Check if the CSS is already loaded to avoid duplicates
    if (!document.querySelector('link[href$="routeRemovalModal.css"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = './css/routeRemovalModal.css'; // Use relative path
        document.head.appendChild(link);
        console.log("Modal CSS loaded");
    }
})();

/**
 * Creates and displays a modal asking the user whether to remove a single route segment or an entire route group
 * @param {number} routeNumber - The route index to potentially remove
 */
export function showRouteRemovalModal(routeNumber) {
    console.log(`Showing route removal modal for route ${routeNumber}`);
    
    // Create or reuse the modal container
    let modalContainer = document.getElementById('route-removal-modal');
    if (!modalContainer) {
        modalContainer = document.createElement('div');
        modalContainer.id = 'route-removal-modal';
        modalContainer.className = 'route-removal-modal';
        document.body.appendChild(modalContainer);
    }
    
    // Make sure modal is visible
    modalContainer.classList.add('active');

    // Get the selected route details
    const selectedRouteData = appState.routeData[routeNumber]?.selectedRoute;
    if (!selectedRouteData) {
        console.error(`Selected route data not found for route ${routeNumber}`);
        return;
    }

    // Get the group ID
    const groupId = selectedRouteData.group;
    console.log(`Route ${routeNumber} belongs to group ${groupId}`);

    // Find all routes in this group using the new routeData structure
    const groupSegments = Object.entries(appState.routeData)
        .filter(([_, route]) => {
            const isInGroup = route?.selectedRoute?.group === groupId;
            return isInGroup;
        })
        .map(([idx, route]) => {
            const displayData = route.selectedRoute.displayData;
            return {
                index: parseInt(idx),
                route: displayData.route || "Unknown Route",
                airline: displayData.airline || "Unknown",
                price: displayData.price || 0
            };
        })
        .sort((a, b) => a.index - b.index);

    if (groupSegments.length === 0) {
        console.error(`No segments found for group ${groupId}`);
        removeRoute(routeNumber);
        return;
    }

    // Get the full journey description (origin to final destination)
    const firstSegment = groupSegments[0];
    const lastSegment = groupSegments[groupSegments.length - 1];
    
    // Safely extract origin and destination
    const fullJourneyOrigin = firstSegment?.route?.split(' > ')[0] || 'Unknown';
    const fullJourneyDest = lastSegment?.route?.split(' > ')[1] || 'Unknown';
    
    const fullJourney = `${fullJourneyOrigin} > ${fullJourneyDest}`;

    // Generate HTML for the modal using existing CSS classes
    modalContainer.innerHTML = `
        <div class="route-removal-modal-content">
            <h3>Remove Selected Route</h3>
            <p>You are about to remove a multi-segment journey:</p>
            <div class="option-container">
                <div class="option-title">${fullJourney}</div>
                ${groupSegments.map(segment => `
                    <div class="option-route">
                        ${segment.route} - ${segment.airline} - $${Math.ceil(segment.price)}
                    </div>
                `).join('')}
            </div>
            <p>Do you want to remove the entire journey or just this segment?</p>
            <div class="route-removal-options">
                <button id="remove-entire-journey">Remove Entire Journey</button>
                <button id="remove-segment-only">Remove This Segment Only</button>
            </div>
            <div class="modal-footer">
                <button id="cancel-remove" class="cancel-btn">Cancel</button>
            </div>
        </div>
    `;

    // Add event listeners
    document.getElementById('remove-entire-journey').addEventListener('click', () => {
        // Find all route indices in this group and remove them
        const routeIndices = groupSegments.map(s => s.index);
        
        // Remove routes in reverse order to avoid index shifting issues
        routeIndices
            .sort((a, b) => b - a) // Sort in descending order
            .forEach(index => removeRoute(index));
        
        modalContainer.classList.remove('active');
        setTimeout(() => modalContainer.remove(), 300);
    });

    document.getElementById('remove-segment-only').addEventListener('click', () => {
        // Only remove the specified segment
        removeRoute(routeNumber);
        modalContainer.classList.remove('active');
        setTimeout(() => modalContainer.remove(), 300);
    });

    document.getElementById('cancel-remove').addEventListener('click', () => {
        modalContainer.classList.remove('active');
        setTimeout(() => modalContainer.remove(), 300);
    });

    // Close modal when clicking outside
    modalContainer.addEventListener('click', (e) => {
        if (e.target === modalContainer) {
            modalContainer.classList.remove('active');
            setTimeout(() => modalContainer.remove(), 300);
        }
    });
}

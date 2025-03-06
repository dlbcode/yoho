import { appState } from '../stateManager.js';
import { removeRoute } from './removeRoute.js';
import { createRouteId } from '../routeDeck/deckFilter.js';

// Load CSS
(function loadModalCSS() {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = './css/routeRemovalModal.css';
    document.head.appendChild(link);
})();

// Keep track of active modal to ensure only one is shown at a time
let activeModal = null;

/**
 * Creates and displays a modal asking the user whether to remove a single route segment or an entire route group
 * @param {number} routeNumber - The route index to potentially remove
 * @returns {HTMLElement} - The created modal element
 */
export function showRouteRemovalModal(routeNumber) {
    // If there's already an active modal, remove it first
    if (activeModal && document.body.contains(activeModal)) {
        activeModal.remove();
        activeModal = null;
    }

    const selectedRoute = appState.selectedRoutes[routeNumber];
    if (!selectedRoute) {
        // If not a selected route, just perform normal removal
        removeRoute(routeNumber);
        return;
    }

    const groupNumber = selectedRoute.group;
    
    // Get all routes in this group
    const groupRoutes = Object.entries(appState.selectedRoutes)
        .filter(([, route]) => route.group === groupNumber)
        .map(([key]) => parseInt(key))
        .sort((a, b) => a - b);
    
    if (groupRoutes.length < 2) {
        // If there's only one route in the group, just remove it
        removeRoute(routeNumber);
        return;
    }
    
    // Create route names for display
    const routeSegmentName = createSegmentName(routeNumber);
    const fullRouteName = createFullRouteName(groupRoutes);
    
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'route-removal-modal';
    
    const modalContent = document.createElement('div');
    modalContent.className = 'route-removal-modal-content';
    
    // Add header and buttons
    modalContent.innerHTML = `
        <h3>Remove</h3>
        <div class="route-removal-options">
            <div class="option-container">
                <div class="option-title">Segment</div>
                <button class="remove-segment-btn">
                    <div class="option-route">${routeSegmentName}</div>
                </button>
            </div>
            <div class="option-container">
                <div class="option-title">Entire route</div>
                <button class="remove-route-btn">
                    <div class="option-route">${fullRouteName}</div>
                </button>
            </div>
        </div>
        <div class="modal-footer">
            <button class="cancel-btn">Cancel</button>
        </div>
    `;
    
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
    activeModal = modal;
    
    // Add event listeners
    const removeSegmentBtn = modal.querySelector('.remove-segment-btn');
    const removeRouteBtn = modal.querySelector('.remove-route-btn');
    const cancelBtn = modal.querySelector('.cancel-btn');
    
    // Click on segment button - remove just this segment
    removeSegmentBtn.addEventListener('click', () => {
        closeModal();
        removeRoute(routeNumber);
    });
    
    // Click on route button - remove all segments in this group
    removeRouteBtn.addEventListener('click', () => {
        closeModal();
        // Remove routes in reverse order to avoid index shifting issues
        [...groupRoutes].reverse().forEach(routeIndex => {
            removeRoute(routeIndex);
        });
    });
    
    // Cancel button click handler
    cancelBtn.addEventListener('click', () => {
        closeModal();
    });
    
    // Close modal on outside click
    modal.addEventListener('click', (event) => {
        if (event.target === modal) {
            closeModal();
        }
    });
    
    // Make modal visible after it's been added to the DOM
    setTimeout(() => {
        if (modal && document.body.contains(modal)) {
            modal.classList.add('active');
        }
    }, 10);
    
    return modal;
}

/**
 * Closes the active modal if it exists
 */
function closeModal() {
    if (activeModal) {
        activeModal.classList.remove('active');
        setTimeout(() => {
            if (activeModal && document.body.contains(activeModal)) {
                activeModal.remove();
                activeModal = null;
            }
        }, 300); // Wait for animation to complete
    }
}

/**
 * Creates a display name for a single route segment (e.g., "LAX-DEN")
 * @param {number} routeNumber - The route index
 * @returns {string} - The formatted route name
 */
function createSegmentName(routeNumber) {
    const fromIndex = routeNumber * 2;
    const toIndex = fromIndex + 1;
    
    const fromWaypoint = appState.waypoints[fromIndex];
    const toWaypoint = appState.waypoints[toIndex];
    
    if (!fromWaypoint || !toWaypoint) {
        return `Route ${routeNumber + 1}`;
    }
    
    return `${fromWaypoint.iata_code}-${toWaypoint.iata_code}`;
}

/**
 * Creates a display name for an entire route (e.g., "LAX-DEN-MSP-EWR")
 * @param {number[]} routeIndices - Array of route indices that form the complete route
 * @returns {string} - The formatted full route name
 */
function createFullRouteName(routeIndices) {
    if (!routeIndices || routeIndices.length === 0) {
        return "Unknown Route";
    }
    
    // Build array of all waypoints in correct order
    const allWaypoints = [];
    
    routeIndices.forEach(routeIndex => {
        const fromIndex = routeIndex * 2;
        const fromWaypoint = appState.waypoints[fromIndex];
        
        if (fromWaypoint && !allWaypoints.some(wp => wp.iata_code === fromWaypoint.iata_code)) {
            allWaypoints.push(fromWaypoint);
        }
        
        const toIndex = fromIndex + 1;
        const toWaypoint = appState.waypoints[toIndex];
        
        if (toWaypoint && !allWaypoints.some(wp => wp.iata_code === toWaypoint.iata_code)) {
            allWaypoints.push(toWaypoint);
        }
    });
    
    return allWaypoints
        .map(wp => wp.iata_code || "Any")
        .join('-');
}

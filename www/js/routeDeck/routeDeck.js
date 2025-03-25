import { appState, updateState } from '../stateManager.js';
import { sliderFilter } from './sliderFilter.js';
import { setSelectedRouteCard } from './routeInfoCard.js';
import { applyFilters, initializeFilterState, resetFilter } from './deckFilter.js';
import { setupRouteContent, infoPane } from '../infoPane.js';
import { infoPaneHeight } from '../utils/infoPaneHeightManager.js';
import { lineManager } from '../lineManager.js';
import { createRouteCard } from './routeCard.js';
import { createDeckFilterControls } from './deckFilterControls.js';
import { drawFlightLines } from './routeHighlighting.js';
import { buildApiUrl } from './deckApiService.js';
import { attachCardEventHandlers } from './cardEventHandlers.js';

// Add to the updateState function before making any state changes
if (typeof window.updateState.use === 'function') {
    // Register a debugging middleware just for routeDeck
    window.updateState.use(function routeDeckDebugMiddleware(key, value, caller) {
        if (key === 'removeWaypoint' && caller === 'buildRouteDeck') {
            console.log(`Route deck detected waypoint removal: ${value}`);
        }
        return true; // Always continue the chain
    });
}

function buildRouteDeck(routeIndex) {
    lineManager.clearLinesByTags(['type:deck']);
    initializeFilterState();

    // Get origin and destination information - first check new route structure
    const routeData = appState.routeData[routeIndex];
    const dateRange = routeData ? 
        { depart: routeData.departDate, return: routeData.returnDate } : 
        (appState.routeDates[routeIndex] ?? {});
    
    // Get origin and destination from routeData if available, otherwise fallback to waypoints
    let origin = routeData?.origin?.iata_code || appState.waypoints[routeIndex * 2]?.iata_code;
    let destination = routeData?.destination?.iata_code || appState.waypoints[(routeIndex * 2) + 1]?.iata_code;

    // Special handling for "Any" origin searches
    if (origin === 'Any') {
        // Create a special waypoint object that won't be cleared
        updateState('updateWaypoint', { 
            index: (routeIndex * 2), 
            data: {
                iata_code: 'Any',
                name: 'Any Origin',
                isAnyDestination: true // Reuse the same flag for simplicity
            }
        }, 'buildRouteDeck');
        
        // Mark the input field
        const originInput = document.getElementById(`waypoint-input-${(routeIndex * 2) + 1}`);
        if (originInput) {
            originInput.value = 'Anywhere';
            originInput.setAttribute('data-is-any-destination', 'true');
        }
        
        // Enable protection mode
        window.preserveAnyDestination = true;
        setTimeout(() => {
            window.preserveAnyDestination = false;
        }, 1000);
    }

    // Special handling for "Any" destination searches
    if (destination === 'Any') {
        // Create a special waypoint object that won't be cleared
        updateState('updateWaypoint', { 
            index: (routeIndex * 2) + 1, 
            data: {
                iata_code: 'Any',
                name: 'Any Destination',
                isAnyDestination: true
            }
        }, 'buildRouteDeck');
        
        // Mark the input field
        const destInput = document.getElementById(`waypoint-input-${(routeIndex * 2) + 2}`);
        if (destInput) {
            destInput.value = 'Anywhere';
            destInput.setAttribute('data-is-any-destination', 'true');
        }
        
        // Enable protection mode
        window.preserveAnyDestination = true;
        setTimeout(() => {
            window.preserveAnyDestination = false;
        }, 1000);
    }

    // Modify this section to prevent removing the "Any" waypoint
    // If destination is 'Any', we should preserve it and not trigger a removeWaypoint action
    if (destination === 'Any') {
        // Make sure we have a waypoint object for "Any" to prevent it from being removed
        if (!appState.waypoints[(routeIndex * 2) + 1]) {
            updateState('updateWaypoint', { 
                index: (routeIndex * 2) + 1, 
                data: { iata_code: 'Any', isAnyDestination: true } 
            }, 'buildRouteDeck');
        }
        
        // Also update route data structure if it exists
        if (appState.routeData[routeIndex]) {
            appState.routeData[routeIndex].destination = {
                iata_code: 'Any',
                name: 'Any Destination',
                isAnyDestination: true
            };
        }
    }

    // Simplify origin/destination logic
    if (!origin || !destination) {
        const { originAirport, destinationAirport } = appState.currentRoute || {};
        origin = originAirport?.iata_code || origin;
        destination = destinationAirport?.iata_code || destination;
    }

    document.head.appendChild(Object.assign(document.createElement('link'), { rel: 'stylesheet', type: 'text/css', href: '../css/routeDeck.css' }));

    const infoPaneElement = document.getElementById('infoPane');
    infoPaneElement.classList.add('loading');

    // **Helper function to format dates to DD/MM/YYYY**
    const formatDate = dateString => dateString || 'any';

    const departDate = dateRange.depart ? formatDate(dateRange.depart) : 'any';
    const returnDate = dateRange.return ? formatDate(dateRange.return) : '';

    const { url: apiUrl, endpoint } = buildApiUrl(origin, destination, departDate, returnDate);

    console.log("API URL:", apiUrl); // Log the generated API URL

    return fetch(apiUrl)
        .then(response => response.json())
        .then(data => {
            console.log("API Response Data:", data); // Log the raw API response data

            // Simplify flightsData assignment
            const flightsData = (endpoint === 'range' || destination === 'Any')
                ? (data?.data || [])
                : (Array.isArray(data) ? data : (data?.data || []));

            console.log("Flights Data:", flightsData); // Log processed flightsData

            const { contentWrapper } = setupRouteContent(routeIndex);
            
            // Keep existing routeBox if present
            const existingRouteBox = contentWrapper.querySelector('#routeBox');
            contentWrapper.innerHTML = ''; // Clear the wrapper
            if (existingRouteBox) {
                contentWrapper.appendChild(existingRouteBox);
            }

            const deckFilterControls = createDeckFilterControls();
            contentWrapper.appendChild(deckFilterControls);

            const cardsContainer = document.createElement('div');
            cardsContainer.className = 'route-cards-container';

            let drawnPaths = new Set();

            flightsData.forEach((flight, index) => {
                const card = createRouteCard(flight, endpoint, routeIndex, destination);
                cardsContainer.appendChild(card);
                
                // Simplified logic - draw lines for each flight once
                const pathKey = flight.route.map(segment => 
                    `${segment.flyFrom}-${segment.flyTo}`).join('|');
                    
                if (!drawnPaths.has(pathKey)) {
                    drawFlightLines(flight, routeIndex, false);
                    drawnPaths.add(pathKey);
                }
                
                // Attach event handlers
                attachCardEventHandlers(card, flight, index, flightsData, routeIndex);
            });

            contentWrapper.appendChild(cardsContainer);
            
            // Use the imported infoPane module
            infoPane.routeDecks.set(routeIndex, contentWrapper);
            
            infoPaneElement.classList.remove('loading');
            infoPaneHeight.setHeight('half');
            
            setSelectedRouteCard(routeIndex);
            attachFilterListeners(cardsContainer, flightsData, routeIndex);
            applyFilters(); // This will show/hide lines based on current filters
        })
        .catch(error => {
            console.error('Error loading data:', error);
            document.getElementById('infoPaneContent').textContent = 'Error loading data: ' + error.message;
            throw error;
        });
}

function attachFilterListeners(container, data, routeIndex) {
    const filterButtons = container.parentElement.querySelectorAll('.filter-button');
    
    filterButtons.forEach(button => {
        const filterType = button.getAttribute('data-filter');

        // Add event listener to the entire button
        button.addEventListener('click', (event) => {
            // Don't trigger if reset icon was clicked
            if (event.target.classList.contains('resetIcon')) {
                return;
            }
            event.stopPropagation();
            sliderFilter.createFilterPopup(filterType, fetchDataForFilter(filterType), event);
        });

        // Add event listeners for reset icons
        const resetIcon = button.querySelector('.resetIcon');
        if (resetIcon) {
            resetIcon.addEventListener('click', (event) => {
                event.stopPropagation();
                const filterType = event.target.getAttribute('data-filter');
                resetFilter(filterType);
            });
        }

        // Keep existing specific element listeners for backward compatibility
        const filterIcon = button.querySelector('.filterIcon');
        if (filterIcon) {
            filterIcon.addEventListener('click', (event) => {
                event.stopPropagation();
                sliderFilter.createFilterPopup(filterType, fetchDataForFilter(filterType), event);
            });
        }

        const filterHeader = button.querySelector('.filter-text');
        if (filterHeader) {
            filterHeader.addEventListener('click', (event) => {
                event.stopPropagation();
                sliderFilter.createFilterPopup(filterType, fetchDataForFilter(filterType), event);
            });
        }
    });
}

function fetchDataForFilter(filterType) {
    const getPriceRange = () => {
        const cards = document.querySelectorAll('.route-card');
        const prices = Array.from(cards)
            .map(card => parseFloat(card.dataset.priceValue))
            .filter(price => !isNaN(price));

        if (prices.length === 0) {
            console.error('No valid prices found');
            return { min: 0, max: 0 };
        }

        const min = Math.min(...prices);
        const max = Math.max(...prices);

        return { min, max };
    };

    switch (filterType) {
        case 'price':
            return getPriceRange();
        case 'departure':
        case 'arrival':
            return { min: 0, max: 24 };
        default:
            console.error('Unsupported filter:', filterType);
            return null;
    }
}

export { buildRouteDeck };
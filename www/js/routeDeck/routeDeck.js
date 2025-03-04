import { appState, updateState } from '../stateManager.js';
import { sliderFilter } from './sliderFilter.js';
import { createSortButton } from './sortDeck.js';
import { pathDrawing, Line } from '../pathDrawing.js';
import { routeInfoCard, setSelectedRouteCard } from './routeInfoCard.js';
import { applyFilters, initializeFilterState, createRouteId, resetFilter } from './filterDeck.js';
import { setupRouteContent, infoPane } from '../infoPane.js';
import { infoPaneHeight } from '../utils/infoPaneHeightManager.js';
import { lineManager } from '../lineManager.js';
import { createRouteCard } from './routeCard.js'; // Import createRouteCard
import { map } from '../map.js';
import { flightMap } from '../flightMap.js';

// Add to the updateState function before making any state changes

// If you want to add debugging for "Any" destination specifically in routeDeck.js,
// use the middleware pattern instead:
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

    // Get origin and destination information
    const dateRange = appState.routeDates[routeIndex] ?? {};
    let origin = appState.waypoints[routeIndex * 2]?.iata_code;
    let destination = appState.waypoints[(routeIndex * 2) + 1]?.iata_code || 'Any';

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
            destInput.value = 'Any';
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

            const filterControls = createFilterControls();
            contentWrapper.appendChild(filterControls);

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
                attachRowEventHandlers(card, flight, index, flightsData, routeIndex);
            });

            contentWrapper.appendChild(cardsContainer);
            
            // Use the imported infoPane module
            infoPane.routeDecks.set(routeIndex, contentWrapper);
            
            infoPaneElement.classList.remove('loading');
            infoPaneHeight.setHeight('half');
            
            setSelectedRouteCard(routeIndex);
            attachEventListeners(cardsContainer, flightsData, routeIndex);
            applyFilters(); // This will show/hide lines based on current filters
        })
        .catch(error => {
            console.error('Error loading data:', error);
            document.getElementById('infoPaneContent').textContent = 'Error loading data: ' + error.message;
            throw error;
        });

    function attachEventListeners(container, data, routeIndex) {
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
}

function handleRouteLineVisibility(flight, routeIndex, isVisible) {
    if (!flight?.route) return;
    
    const cardId = `deck-${routeIndex}-${flight.id}`;
    const routeLines = Object.values(pathDrawing.routePathCache)
        .flat()
        .filter(l => l.routeData?.cardId === cardId);
        
    routeLines.forEach(line => {
        if (line instanceof Line) {
            if (line.tags.has('isTemporary')) {
                // Always remove temporary lines
                line.remove();
                // Remove from cache
                const routeId = line.routeId;
                pathDrawing.routePathCache[routeId] = 
                    pathDrawing.routePathCache[routeId].filter(l => l !== line);
            } else {
                isVisible ? line.highlight() : line.reset();
            }
        }
    });
}

// Replace multiple occurrences of line styling with a single helper function
function applyLineHighlightStyle(line) {
    if (line instanceof Line && line.visibleLine) {
        line.visibleLine.setStyle({ color: 'white', weight: 2, opacity: 1 });
        line.visibleLine.setZIndexOffset(1000);
        line.visibleLine.bringToFront();
    }
}

// Replace repeated route path creation with a helper function
function createRouteData(flight, segment, nextSegment, cardId) {
    return {
        cardId,
        segmentInfo: {
            originAirport: segment,
            destinationAirport: nextSegment,
            date: segment.local_departure
        },
        routeInfo: {
            originAirport: flight.route[0],
            destinationAirport: flight.route[flight.route.length - 1],
            price: flight.price,
            date: flight.route[0].local_departure,
            fullRoute: flight.route,
            deep_link: flight.deep_link,
            bags_price: flight.bags_price,
            duration: flight.duration
        }
    };
}

function drawFlightLines(flight, routeIndex, isTemporary = false) {
    // Cache route path calculations to reduce redundant operations
    const pathCache = {};
    const cardId = `deck-${routeIndex}-${flight.id}`;
    const drawnLines = [];

    flight.route.forEach((segment, idx) => {
        const nextSegment = flight.route[idx + 1] || {
            ...segment,
            flyFrom: segment.flyTo,
            local_departure: segment.local_arrival
        };

        const routeId = createRouteId([{flyFrom: segment.flyFrom, flyTo: segment.flyTo}]);
        
        // Check cache to avoid redundant calculations for the same route segment
        if (!pathCache[routeId]) {
            const routeData = createRouteData(flight, segment, nextSegment, cardId);

            const line = pathDrawing.drawLine(routeId, 'route', {
                price: flight.price,
                iata: segment.flyFrom,
                isDeckRoute: true,
                isTemporary,
                routeData
            });

            if (line) {
                drawnLines.push(line);
                if (isTemporary) {
                    applyLineHighlightStyle(line);
                }
                pathCache[routeId] = true;
            }
        }
    });

    return drawnLines;
}

// Standardize terminology and improve conciseness in attachRowEventHandlers
function attachRowEventHandlers(card, flight, index, data, routeIndex) {
    // Use event delegation for common events
    const handlers = {
        click: () => {
            const routeIdString = card.getAttribute('data-route-id');
            const routeIds = routeIdString.split('|');
            const fullFlightData = data[index];
            
            fitMapToFlightRoute(flight).catch(err => 
                console.error("Error handling map view adjustment:", err)
            );
            
            routeInfoCard(card, fullFlightData, routeIds, routeIndex);
        },
        
        mouseover: () => {
            if (!flight?.route) return;
            
            const routePath = createRouteId(flight.route);
            
            // Use cached flight path when possible instead of recomputing
            const cardId = `deck-${routeIndex}-${flight.id}`;
            const existingRouteLines = Object.values(pathDrawing.routePathCache)
                .flat()
                .filter(l => flight.route.some((segment) => {
                    const segmentPath = `${segment.flyFrom}-${segment.flyTo}`;
                    return l.routeId === segmentPath;
                }));
            
            if (existingRouteLines.length > 0) {
                existingRouteLines.forEach(line => {
                    if (line instanceof Line) {
                        line.routeData = {
                            ...line.routeData,
                            cardId: cardId
                        };
                        line.highlight();
                    }
                });
            } else {
                drawFlightLines(flight, routeIndex, true);
            }
        },
        
        mouseout: () => {
            handleRouteLineVisibility(flight, routeIndex, false);
        }
    };

    // Add all event listeners at once
    Object.entries(handlers).forEach(([event, handler]) => {
        card.addEventListener(event, handler);
    });
    
    // Store handlers on element for potential cleanup later
    card._handlers = handlers;
}

// New function to fit the map to a flight's route
async function fitMapToFlightRoute(flight) {
    // Skip unnecessary processing early
    if (appState.preventMapViewChange || !flight.route || flight.route.length === 0) {
        return;
    }
    
    try {
        // Use Set for unique IATA codes more efficiently
        const iataSet = new Set(
            flight.route.flatMap(segment => [segment.flyFrom, segment.flyTo].filter(Boolean))
        );
        
        const iataList = [...iataSet];
        if (iataList.length === 0) return;
        
        // Get airport data in parallel with Promise.all
        const validAirports = (await Promise.all(
            iataList.map(iata => flightMap.getAirportDataByIata(iata))
        )).filter(airport => airport && airport.latitude && airport.longitude);
        
        if (validAirports.length === 0) return;
        
        // Use array methods instead of loops where possible
        const latitudes = validAirports.map(airport => airport.latitude);
        const longitudes = validAirports.map(airport => airport.longitude);
        
        const minLat = Math.min(...latitudes);
        const maxLat = Math.max(...latitudes);
        const minLong = Math.min(...longitudes);
        const maxLong = Math.max(...longitudes);
        
        const spansDegrees = maxLong - minLong;
        const crossesAntimeridian = spansDegrees > 180;
        
        if (crossesAntimeridian) {
            // Special handling for routes crossing the antimeridian (180° longitude)
            const adjustedLongitudes = longitudes.map(lon => lon < 0 ? lon + 360 : lon);
            const adjustedMinLong = Math.min(...adjustedLongitudes);
            const adjustedMaxLong = Math.max(...adjustedLongitudes);
            
            // Center around the middle of the adjusted longitudes
            const centerLong = ((adjustedMinLong + adjustedMaxLong) / 2) % 360;
            const centerLat = (minLat + maxLat) / 2;
            
            // Fit the map to the bounds
            map.fitBounds([
                [minLat, centerLong - 180],
                [maxLat, centerLong + 180]
            ]);
        } else {
            // Normal case - create bounds and fit map
            map.fitBounds([
                [minLat, minLong],
                [maxLat, maxLong]
            ]);
        }
    } catch (error) {
        console.error("Error fitting map to flight route:", error);
    }
}

function buildApiUrl(origin, destination, departDate, returnDate) {
    let endpoint, url;

    if (destination === 'Any') {
        endpoint = 'cheapestFlights';
        url = `https://yonderhop.com/api/${endpoint}?origin=${origin}`;
        
        if (departDate !== 'any') {
            const [dateFrom, dateTo] = departDate.includes(' to ') 
                ? departDate.split(' to ') 
                : [departDate, departDate];
            url += `&date_from=${dateFrom}&date_to=${dateTo}`;
        }
    } else {
        if (departDate === 'any' || returnDate === 'any') {
            endpoint = 'range';
            url = `https://yonderhop.com/api/${endpoint}?flyFrom=${origin}&flyTo=${destination}`;
        } else if (departDate.includes(' to ') || returnDate.includes(' to ')) {
            endpoint = 'range';
            const [dateFrom, dateTo] = departDate.includes(' to ') 
                ? departDate.split(' to ') 
                : [departDate, returnDate];
            url = `https://yonderhop.com/api/${endpoint}?flyFrom=${origin}&flyTo=${destination}&dateFrom=${dateFrom}&dateTo=${dateTo}`;
        } else {
            endpoint = returnDate ? 'yhreturn' : 'yhoneway';
            url = `https://yonderhop.com/api/${endpoint}?origin=${origin}&destination=${destination}&departureDate=${departDate}`;
            if (returnDate) url += `&returnDate=${returnDate}`;
        }
    }

    return { url, endpoint };
}

function createFilterControls() {
    const filterControls = document.createElement('div');
    filterControls.className = 'filter-controls';
    
    // Create a separate container for filter buttons
    const filterButtonsContainer = document.createElement('div');
    filterButtonsContainer.className = 'filter-buttons-container';

    // Create scroll indicator
    const scrollIndicator = document.createElement('div');
    scrollIndicator.className = 'scroll-indicator';
    filterButtonsContainer.appendChild(scrollIndicator);

    // Set up scroll indicator with mutation observer
    setupScrollIndicator(filterButtonsContainer);

    const filters = ['departure', 'arrival', 'price'];
    filters.forEach(filterType => {
        const filterButton = document.createElement('button');
        filterButton.className = 'filter-button';
        filterButton.setAttribute('data-filter', filterType); // Changed attribute name
        
        filterButton.innerHTML = `
            <span class="filter-text" data-filter="${filterType}">${filterType.charAt(0).toUpperCase() + filterType.slice(1)}</span>
            <img class="filterIcon" id="${filterType}Filter" data-filter="${filterType}" src="/assets/filter-icon.svg" alt="Filter">
            <span class="resetIcon hidden" id="reset${filterType.charAt(0).toUpperCase() + filterType.slice(1)}Filter" 
                  data-filter="${filterType}">✕</span>
        `;
        
        filterButtonsContainer.appendChild(filterButton);
    });

    // Create a separate container for the sort button
    const sortControls = document.createElement('div');
    sortControls.className = 'sort-controls'; // Change class name to avoid confusion
    sortControls.appendChild(createSortButton()); // Add the sort button to the sort controls

    filterControls.appendChild(filterButtonsContainer);
    filterControls.appendChild(sortControls);

    // Setup scroll indicator
    setupScrollIndicator(filterButtonsContainer);

    return filterControls;
}

// Use a throttled version to reduce calculations
function updateScrollIndicator(container) {
    // Clear any pending animation frame
    if (updateScrollIndicator.frameId) {
        cancelAnimationFrame(updateScrollIndicator.frameId);
    }
    
    // Schedule the update in the next animation frame
    updateScrollIndicator.frameId = requestAnimationFrame(() => {
        const buttonsContainer = container instanceof Event ? container.target : container;
        const scrollIndicator = buttonsContainer.querySelector('.scroll-indicator');
        
        const containerWidth = buttonsContainer.clientWidth;
        const scrollWidth = buttonsContainer.scrollWidth;
        
        if (scrollWidth <= containerWidth) {
            scrollIndicator.style.width = '0';
            scrollIndicator.style.transform = 'translateX(0)';
            return;
        }

        // Calculate the visible ratio and line width
        const visibleRatio = containerWidth / scrollWidth;
        const lineWidth = Math.max(containerWidth * visibleRatio, 30);
        
        // Calculate scroll values
        const overflowAmount = scrollWidth - containerWidth;
        const scrollProgress = buttonsContainer.scrollLeft / overflowAmount;
        
        // Calculate maximum travel distance
        const maxTravel = containerWidth - lineWidth;
        const leftPosition = scrollProgress * maxTravel * 2.25;

        scrollIndicator.style.width = `${lineWidth}px`;
        scrollIndicator.style.transform = `translateX(${leftPosition}px)`;
    });
}

// Add a mutation observer to watch for content changes
function setupScrollIndicator(filterButtonsContainer) {
    // Store observer in container to prevent multiple observers on the same element
    if (!filterButtonsContainer._scrollObserver) {
        const observer = new MutationObserver(() => updateScrollIndicator(filterButtonsContainer));
        
        observer.observe(filterButtonsContainer, {
            childList: true,
            subtree: true,
            characterData: true,
            attributes: true
        });
        
        // Save observer reference to prevent duplicates
        filterButtonsContainer._scrollObserver = observer;
        
        // Use passive event listener for scroll performance
        filterButtonsContainer.addEventListener('scroll', updateScrollIndicator, { passive: true });
        
        // Use debounced resize handler
        if (!window._resizeHandlerSet) {
            const resizeHandler = () => {
                document.querySelectorAll('.filter-buttons-container').forEach(container => {
                    updateScrollIndicator(container);
                });
            };
            
            window.addEventListener('resize', resizeHandler);
            window._resizeHandlerSet = true;
        }
        
        // Initial update
        updateScrollIndicator(filterButtonsContainer);
    }
}
export { buildRouteDeck };
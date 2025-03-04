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
    const cardId = `deck-${routeIndex}-${flight.id}`;
    const drawnLines = [];

    flight.route.forEach((segment, idx) => {
        const nextSegment = flight.route[idx + 1] || {
            ...segment,
            flyFrom: segment.flyTo,
            local_departure: segment.local_arrival
        };

        const routeId = createRouteId([{flyFrom: segment.flyFrom, flyTo: segment.flyTo}]);

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
        }
    });

    return drawnLines;
}

// Standardize terminology and improve conciseness in attachRowEventHandlers
function attachRowEventHandlers(card, flight, index, data, routeIndex) {
    card.addEventListener('click', () => {
        const routeIdString = card.getAttribute('data-route-id');
        const routeIds = routeIdString.split('|');
        const fullFlightData = data[index];
        
        // Fit the map to the route coordinates - now handles the Promise
        fitMapToFlightRoute(flight).catch(err => 
            console.error("Error handling map view adjustment:", err)
        );
        
        routeInfoCard(card, fullFlightData, routeIds, routeIndex);
    });

    card.addEventListener('mouseover', () => {
        if (!flight?.route) return;
        
        const routePath = createRouteId(flight.route);
        
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
                        cardId: `deck-${routeIndex}-${flight.id}`
                    };
                    line.highlight();
                }
            });
        } else {
            drawFlightLines(flight, routeIndex, true);
        }
    });

    card.addEventListener('mouseout', () => {
        handleRouteLineVisibility(flight, routeIndex, false);
    });
}

// New function to fit the map to a flight's route
async function fitMapToFlightRoute(flight) {
    // Skip if map view changes are prevented
    if (appState.preventMapViewChange) {
        console.log("Map view change prevented by flag");
        return;
    }
    
    if (!flight.route || flight.route.length === 0) {
        console.log("No route segments to fit map to");
        return;
    }
    
    try {
        // Collect all unique IATA codes in the route
        const iataSet = new Set();
        flight.route.forEach(segment => {
            if (segment.flyFrom) iataSet.add(segment.flyFrom);
            if (segment.flyTo) iataSet.add(segment.flyTo);
        });
        
        const iataList = [...iataSet];
        
        if (iataList.length === 0) {
            console.error("No IATA codes found in flight route", flight);
            return;
        }
        
        console.log(`Found ${iataList.length} unique airports in route`);
        
        // Get airport data for each IATA code
        const airportsPromises = iataList.map(iata => flightMap.getAirportDataByIata(iata));
        const airportsData = await Promise.all(airportsPromises);
        
        // Filter out any null results
        const validAirports = airportsData.filter(airport => airport && airport.latitude && airport.longitude);
        
        if (validAirports.length === 0) {
            console.error("Could not find coordinates for any airports in the route");
            return;
        }
        
        // Check if the route crosses the antimeridian (international date line)
        const longitudes = validAirports.map(airport => airport.longitude);
        const minLong = Math.min(...longitudes);
        const maxLong = Math.max(...longitudes);
        
        // If the route spans more than 180 degrees, it likely crosses the antimeridian
        const spansDegrees = maxLong - minLong;
        const crossesAntimeridian = spansDegrees > 180;
        
        console.log(`Route longitude span: ${spansDegrees}°, crosses antimeridian: ${crossesAntimeridian}`);
        
        if (crossesAntimeridian) {
            // Adjust the center point to be in the middle of the route, accounting for the antimeridian
            
            // Convert all longitudes to be in the same hemisphere (all positive or all negative)
            const adjustedLongitudes = longitudes.map(lng => {
                if (minLong < 0 && lng > 0) {
                    // If min is negative and this point is positive, make it negative too
                    return lng - 360;
                } else if (minLong > 0 && lng < 0) {
                    // If min is positive and this point is negative, make it positive too
                    return lng + 360;
                }
                return lng;
            });
            
            // Calculate the center longitude in the adjusted coordinate space
            const centerLong = adjustedLongitudes.reduce((sum, lng) => sum + lng, 0) / adjustedLongitudes.length;
            
            // Calculate the center latitude
            const centerLat = validAirports.reduce((sum, airport) => sum + airport.latitude, 0) / validAirports.length;
            
            // Create adjusted latLng points for fitBounds
            const waypoints = validAirports.map((airport, idx) => 
                L.latLng(airport.latitude, adjustedLongitudes[idx])
            );
            
            // Create a bounds object to determine the appropriate zoom level
            const bounds = L.latLngBounds(waypoints);
            
            // Get the appropriate zoom that would fit these bounds
            // We need to temporarily set the view center first
            const originalCenter = map.getCenter();
            const originalZoom = map.getZoom();
            
            // Temporarily move the map to calculate proper zoom
            map.setView([centerLat, centerLong], originalZoom, {animate: false});
            
            // Get the zoom level that would fit the bounds
            const fitZoom = map.getBoundsZoom(bounds, false, [50, 50]);
            
            // Now set the view with the calculated center and zoom
            map.setView([centerLat, centerLong], fitZoom, {animate: true});
            
            console.log(`Set view to center at [${centerLat}, ${centerLong}] with zoom ${fitZoom}`);
        } else {
            // For routes that don't cross the antimeridian, we can use the standard fitBounds
            const waypoints = validAirports.map(airport => L.latLng(airport.latitude, airport.longitude));
            console.log(`Successfully retrieved coordinates for ${waypoints.length} airports`);
            
            if (waypoints.length > 1) {
                // Create bounds and fit the map to them with padding
                const bounds = L.latLngBounds(waypoints);
                map.fitBounds(bounds, { padding: [50, 50], animate: true });
            } else if (waypoints.length === 1) {
                map.setView(waypoints[0], 5, {animate: true});
            }
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

function updateScrollIndicator(container) {
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
    // multiply by 2.25 to compensate for the scrolling within the container
    const leftPosition = scrollProgress * maxTravel * 2.25;

    // Apply changes in a requestAnimationFrame for smooth updates
    requestAnimationFrame(() => {
        scrollIndicator.style.width = `${lineWidth}px`;
        scrollIndicator.style.transform = `translateX(${leftPosition}px)`;
    });
}

// Add a mutation observer to watch for content changes
function setupScrollIndicator(filterButtonsContainer) {
    const observer = new MutationObserver(() => updateScrollIndicator(filterButtonsContainer));
    
    observer.observe(filterButtonsContainer, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true
    });
    
    // Initial update
    updateScrollIndicator(filterButtonsContainer);
    
    // Add event listeners
    filterButtonsContainer.addEventListener('scroll', updateScrollIndicator);
    window.addEventListener('resize', () => updateScrollIndicator(filterButtonsContainer));
}
export { buildRouteDeck };
import { appState } from '../stateManager.js';
import { sliderFilter } from './sliderFilter.js';
import { createSortButton } from './sortDeck.js';
import { pathDrawing, Line } from '../pathDrawing.js';
import { routeInfoCard, setSelectedRouteCard } from './routeInfoCard.js';
import { applyFilters, initializeFilterState, createRouteId } from './filterDeck.js';
import { setupRouteContent, infoPane } from '../infoPane.js';
import { infoPaneHeight } from '../utils/infoPaneHeightManager.js';
import { lineManager } from '../lineManager.js';
import { createRouteCard } from './routeCard.js'; // Import createRouteCard

function buildRouteDeck(routeIndex) {
    lineManager.clearLinesByTags(['type:deck']); // Clear any existing route deck lines

    initializeFilterState();

    // Use optional chaining and nullish coalescing for conciseness
    const dateRange = appState.routeDates[routeIndex] ?? {};
    let origin = appState.waypoints[routeIndex * 2]?.iata_code;
    let destination = appState.waypoints[(routeIndex * 2) + 1]?.iata_code || 'Any';

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
            filterControls.appendChild(createSortButton()); // Add the sort button to the filter controls
            contentWrapper.appendChild(filterControls);

            const cardsContainer = document.createElement('div');
            cardsContainer.className = 'route-cards-container';

            flightsData.forEach((flight, index) => {
                const card = createRouteCard(flight, endpoint, routeIndex, destination);
                cardsContainer.appendChild(card);
                
                // Draw initial route lines (add this)
                drawFlightLines(flight, routeIndex, false);
                
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
            const handleFilterClick = (event) => {
                event.stopPropagation();
                const filterType = button.getAttribute('data-filter'); // Changed attribute name
                if (!filterType) {
                    console.error('Filter attribute is missing on the button:', button);
                    return;
                }
                
                const data = fetchDataForFilter(filterType);
                if (data) {
                    sliderFilter.createFilterPopup(filterType, data, event);
                } else {
                    console.error('Failed to fetch data for filter:', filterType);
                }
            };

            // Attach click handlers to the button
            button.addEventListener('click', handleFilterClick);
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
                line.remove();
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

function formatFlightDateTime(date) {
    const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
    return `${dayName} ${date.toLocaleString()}`;
}

function getPriceRangeCategory(price) {
    const ranges = [
        { max: 100, label: '0-100' },
        { max: 200, label: '100-200' },
        { max: 300, label: '200-300' },
        { max: 400, label: '300-400' },
        { max: 500, label: '400-500' }
    ];
    
    const range = ranges.find(r => price < r.max);
    return `price-range:${range ? range.label : '500+'}`;
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
        routeInfoCard(card, fullFlightData, routeIds, routeIndex); // Use card instead of row
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
    
    const filters = ['departure', 'arrival', 'price'];
    filters.forEach(filterType => {
        const filterButton = document.createElement('button');
        filterButton.className = 'filter-button';
        filterButton.setAttribute('data-filter', filterType); // Changed attribute name
        
        filterButton.innerHTML = `
            <span class="filter-header" data-filter="${filterType}">${filterType.charAt(0).toUpperCase() + filterType.slice(1)}</span>
            <img class="filterIcon" id="${filterType}Filter" data-filter="${filterType}" src="/assets/filter-icon.svg" alt="Filter">
            <span class="resetIcon hidden" id="reset${filterType.charAt(0).toUpperCase() + filterType.slice(1)}Filter" 
                  data-filter="${filterType}">✕</span>
        `;
        
        filterControls.appendChild(filterButton);
    });

    return filterControls;
}

export { buildRouteDeck };
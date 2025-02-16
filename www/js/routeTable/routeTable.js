import { appState } from '../stateManager.js';
import { sliderFilter } from './sliderFilter.js';
import { sortTableByColumn } from './sortTable.js';
import { pathDrawing, Line } from '../pathDrawing.js';
import { routeInfoRow, highlightSelectedRowForRouteIndex } from './routeInfoRow.js';
import { applyFilters, toggleFilterResetIcon, updateFilterHeaders } from './filterTable.js';
import { setupRouteContent, infoPane } from '../infoPane.js';
import { infoPaneHeight } from '../utils/infoPaneHeightManager.js';
import { lineManager } from '../lineManager.js';

function buildRouteTable(routeIndex) {
    lineManager.clearLinesByTags(['type:table']); // Clear any existing route table lines

    appState.filterState = {
        departure: { start: 0, end: 24 },
        arrival: { start: 0, end: 24 }
    };

    // Check if appState.routeDates[routeIndex] exists before accessing its properties
    const dateRange = appState.routeDates[routeIndex] || {}; // Provide an empty object as a fallback
    let origin, destination, currentRoute, departDate, returnDate, apiUrl, endpoint;

    // Update this section to use the most current waypoint data
    origin = appState.waypoints[routeIndex * 2]?.iata_code;
    destination = appState.waypoints[(routeIndex * 2) + 1]?.iata_code || 'Any';

    // Only fall back to routes if waypoints aren't available
    if (!origin || !destination) {
        if (currentRoute?.originAirport && currentRoute?.destinationAirport) {
            origin = currentRoute.originAirport.iata_code;
            destination = currentRoute.destinationAirport.iata_code;
        }
    }

    document.head.appendChild(Object.assign(document.createElement('link'), { rel: 'stylesheet', type: 'text/css', href: '../css/routeTable.css' }));

    // Update DOM element references to be more specific
    const infoPaneElement = document.getElementById('infoPane');

    // Start the loading animation
    infoPaneElement.classList.add('loading');

    // **Helper function to format dates to DD/MM/YYYY**
    const formatDate = dateString => dateString || 'any';

    // Check if dateRange and its properties are defined before formatting
    departDate = dateRange.depart ? formatDate(dateRange.depart) : 'any';
    returnDate = dateRange.return ? formatDate(dateRange.return) : '';

    const { url, endpoint: apiEndpoint } = buildApiUrl(origin, destination, departDate, returnDate);
    apiUrl = url;
    endpoint = apiEndpoint;

    console.log("API URL:", apiUrl); // Log the generated API URL

    return fetch(apiUrl)
        .then(response => response.json())
        .then(data => {
            console.log("API Response Data:", data); // Log the raw API response data
            let flightsData;

            if (endpoint === 'range' || destination === 'Any') {
                if (data && data.data && Array.isArray(data.data)) {
                    flightsData = data.data;
                } else {
                    console.error("Unexpected data format from API (range or Any):", data);
                    flightsData = []; // Set empty array for error case
                }
            } else { // Handle yhoneway and potentially yhreturn endpoints
                if (Array.isArray(data)) { // Check if data is already an array
                    flightsData = data;
                } else if (data && data.data && Array.isArray(data.data)) {
                    flightsData = data.data;
                } else {
                    console.error("Unexpected data format from API (yhoneway/yhreturn):", data);
                    flightsData = []; // Set empty array for error case
                }
            }
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

            flightsData.forEach((flight, index) => {
                const card = createRouteCard(flight, endpoint, routeIndex, destination);
                cardsContainer.appendChild(card);
                
                // Attach event handlers
                attachRowEventHandlers(card, flight, index, flightsData, routeIndex);
            });

            contentWrapper.appendChild(cardsContainer);
            
            // Use the imported infoPane module
            infoPane.routeTables.set(routeIndex, contentWrapper);
            
            infoPaneElement.classList.remove('loading');
            infoPaneHeight.setHeight('half');
            
            highlightSelectedRowForRouteIndex(routeIndex);
            attachEventListeners(cardsContainer, flightsData, routeIndex);
            applyFilters(); // This will show/hide lines based on current filters
        })
        .catch(error => {
            console.error('Error loading data:', error);
            document.getElementById('infoPaneContent').textContent = 'Error loading data: ' + error.message;
            throw error;
        });

    function attachEventListeners(container, data, routeIndex) {
        // Remove the table header related code
        const filterButtons = container.parentElement.querySelectorAll('.filter-button');
        
        filterButtons.forEach(button => {
            const filterIcon = button.querySelector('.filterIcon');
            const filteredHeader = button.querySelector('.filteredHeader');
            
            const handleFilterClick = function(event) {
                event.stopPropagation();
                const column = this.getAttribute('data-column');
                if (!column) {
                    console.error('Column attribute is missing on the button:', this);
                    return;
                }
                
                const data = fetchDataForColumn(column);
                if (data) {
                    sliderFilter.createFilterPopup(column, data, event);
                } else {
                    console.error('Failed to fetch data for column:', column);
                }
            };

            // Attach click handlers to both the button and its children
            button.addEventListener('click', handleFilterClick);
            if (filterIcon) {
                filterIcon.addEventListener('click', handleFilterClick);
            }
            if (filteredHeader) {
                filteredHeader.addEventListener('click', handleFilterClick);
            }
        });

        // Add event handlers to cards
        document.querySelectorAll('.route-card').forEach((card, index) => {
            attachRowEventHandlers(card, data[index], index, data, routeIndex);
        });

        updateFilterHeaders();
        toggleFilterResetIcon('price');
        toggleFilterResetIcon('departure');
        toggleFilterResetIcon('arrival');
    }

    function resetSortIcons(headers, currentIcon, newSortState) {
        headers.forEach(header => {
            const icon = header.querySelector('.sortIcon');
            if (icon !== currentIcon) {
                icon.innerHTML = '&#x21C5;'; // Reset to double arrow
                icon.removeAttribute('data-sort');
            } else {
                icon.innerHTML = newSortState === 'asc' ? '&#x25B2;' : '&#x25BC;';
                icon.setAttribute('data-sort', newSortState);
            }
        });
    }

    function getColumnIndex(columnIdentifier) {
        const columnMap = {
            'departure': 0,
            'arrival': 1,
            'price': 2,
            'airlines': 3,
            'direct': 4,
            'stops': 5,
            'layovers': 6,
            'duration': 7,
            'route': 8
        };
        return columnMap[columnIdentifier];
    }

    function fetchDataForColumn(column) {
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

        switch (column) {
            case 'price':
                return getPriceRange();
            case 'departure':
            case 'arrival':
                return { min: 0, max: 24 };
            default:
                console.error('Unsupported column:', column);
                return null;
        }
    }
}

function handleRouteLineVisibility(flight, routeIndex, isVisible) {
    if (!flight?.route) return;
    
    const tableRouteId = `table-${routeIndex}-${flight.id}`;
    const routeLines = Object.values(pathDrawing.routePathCache)
        .flat()
        .filter(l => l.routeData?.tableRouteId === tableRouteId);
        
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
function getRoutePath(flight) {
    return flight.route
        .map(segment => segment.flyFrom)
        .concat(flight.route[flight.route.length - 1].flyTo)
        .join('-');
}

function createRouteData(flight, segment, nextSegment, tableRouteId) {
    return {
        tableRouteId,
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

function setupFilterIcon(element, handleFilterClick) {
    if (element) {
        element.classList.add('filter-button');
        element.addEventListener('click', handleFilterClick);
    }
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
    const tableRouteId = `table-${routeIndex}-${flight.id}`;
    const drawnLines = [];

    flight.route.forEach((segment, idx) => {
        const nextSegment = idx < flight.route.length - 1 
            ? flight.route[idx + 1]
            : {
                ...segment,
                flyFrom: segment.flyTo,
                local_departure: segment.local_arrival
            };

        const routeId = `${segment.flyFrom}-${segment.flyTo}`;
        const routeData = createRouteData(flight, segment, nextSegment, tableRouteId);

        const line = pathDrawing.drawLine(routeId, 'route', {
            price: flight.price,
            iata: segment.flyFrom,
            isTableRoute: true,
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

function attachRowEventHandlers(row, flight, index, data, routeIndex) {
    row.addEventListener('click', () => {
        const routeIdString = row.getAttribute('data-route-id');
        const routeIds = routeIdString.split('|');
        const fullFlightData = data[index];
        routeInfoRow(row, fullFlightData, routeIds, routeIndex);
    });

    row.addEventListener('mouseover', () => {
        if (!flight?.route) return;
        
        const routePath = getRoutePath(flight);
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
                        tableRouteId: `table-${routeIndex}-${flight.id}`
                    };
                    line.highlight();
                }
            });
        } else {
            drawFlightLines(flight, routeIndex, true);
        }
    });

    row.addEventListener('mouseout', () => {
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
    
    const columns = ['departure', 'arrival', 'price'];
    columns.forEach(column => {
        const filterButton = document.createElement('button');
        filterButton.className = 'filter-button';
        filterButton.setAttribute('data-column', column);
        
        filterButton.innerHTML = `
            <span class="filteredHeader" data-column="${column}">${column.charAt(0).toUpperCase() + column.slice(1)}</span>
            <img class="filterIcon" id="${column}Filter" data-column="${column}" src="/assets/filter-icon.svg" alt="Filter">
            <span class="resetIcon" id="reset${column.charAt(0).toUpperCase() + column.slice(1)}Filter" 
                  data-column="${column}" style="display:none;">✕</span>
        `;
        
        filterControls.appendChild(filterButton);
    });
    
    return filterControls;
}

function createRouteCard(flight, endpoint, routeIndex, destination) {
    const card = document.createElement('div');
    card.className = 'route-card';
    
    const departureDate = endpoint === 'range' || destination === 'Any' 
        ? new Date(flight.dTime * 1000)
        : new Date(flight.local_departure);
    const arrivalDate = endpoint === 'range' || destination === 'Any'
        ? new Date(flight.aTime * 1000)
        : new Date(flight.local_arrival);

    const routeId = `${flight.flyFrom}-${flight.flyTo}`;
    const tableRouteId = `table-${routeIndex}-${flight.id}`;
    
    card.setAttribute('data-route-id', routeId);
    card.setAttribute('data-table-route-id', tableRouteId);
    card.setAttribute('data-price', flight.price);
    card.setAttribute('data-departure-time', departureDate.getHours() + departureDate.getMinutes() / 60);
    card.setAttribute('data-arrival-time', arrivalDate.getHours() + arrivalDate.getMinutes() / 60);
    card.setAttribute('data-price-range', getPriceRangeCategory(flight.price));
    card.setAttribute('data-price-value', Math.round(flight.price));

    card.innerHTML = `
        <div class="card-header">
            <div class="card-price">$${flight.price.toFixed(2)}</div>
            <div class="card-duration">
                <span class="detail-label">Duration</span>
                <span class="detail-value">${Math.floor(flight.duration.total / 3600)}h ${Math.floor((flight.duration.total % 3600) / 60)}m</span>
            </div>
        </div>
        
        <div class="card-route">
            ${flight.route.map((segment, idx) => `
                <div class="route-segment">
                    <div class="detail-group">
                        <div class="detail-label">${idx === 0 ? 'From' : 'Via'}</div>
                        <div class="detail-value">${segment.flyFrom}</div>
                    </div>
                    ${idx < flight.route.length - 1 ? '<span class="route-arrow">→</span>' : ''}
                </div>
            `).join('')}
            <div class="route-segment">
                <div class="detail-group">
                    <div class="detail-label">To</div>
                    <div class="detail-value">${flight.route[flight.route.length - 1].flyTo}</div>
                </div>
            </div>
        </div>

        <div class="card-details">
            <div class="detail-group">
                <div class="detail-label">Departure</div>
                <div class="detail-value">${formatFlightDateTime(departureDate)}</div>
            </div>
            <div class="detail-group">
                <div class="detail-label">Arrival</div>
                <div class="detail-value">${formatFlightDateTime(arrivalDate)}</div>
            </div>
            <div class="detail-group">
                <div class="detail-label">Airlines</div>
                <div class="detail-value">${flight.airlines.join(", ")}</div>
            </div>
            <div class="detail-group">
                <div class="detail-label">Stops</div>
                <div class="detail-value">${flight.route.length - 1}</div>
            </div>
        </div>
    `;

    return card;
}

export { buildRouteTable };
import { appState } from '../stateManager.js';
import { sliderFilter } from './sliderFilter.js';
import { sortTableByColumn } from './sortTable.js';
import { pathDrawing, Line } from '../pathDrawing.js';
import { flightMap } from '../flightMap.js';
import { routeInfoRow, highlightSelectedRowForRouteIndex } from './routeInfoRow.js';
import { applyFilters, toggleFilterResetIcon, updateFilterHeaders, constructFilterTags } from './filterTable.js';
import { setupRouteContent } from '../infoPane.js';

function buildRouteTable(routeIndex) {
    appState.filterState = {
        departure: { start: 0, end: 24 },
        arrival: { start: 0, end: 24 }
    };

    // Check if appState.routeDates[routeIndex] exists before accessing its properties
    const dateRange = appState.routeDates[routeIndex] || {}; // Provide an empty object as a fallback
    let origin, destination, currentRoute, departDate, returnDate, apiUrl, endpoint;
    currentRoute = appState.routes[routeIndex];

    if (appState.routes[routeIndex] && appState.routes[routeIndex].originAirport && appState.routes[routeIndex].destinationAirport) {
        origin = appState.routes[routeIndex].originAirport.iata_code;
        destination = appState.routes[routeIndex].destinationAirport.iata_code;
    } else {
        origin = appState.waypoints[routeIndex * 2]?.iata_code;
        destination = appState.waypoints[(routeIndex * 2) + 1]?.iata_code || 'Any';
    }

    document.head.appendChild(Object.assign(document.createElement('link'), { rel: 'stylesheet', type: 'text/css', href: '../css/routeTable.css' }));

    // Start the loading animation
    const topBar = document.getElementById('top-bar');
    infoPane.classList.add('loading');

    // Start loading animation
    const infoPaneContent = document.getElementById('infoPaneContent');
    infoPane.classList.add('loading');

    // **Helper function to format dates to DD/MM/YYYY**
    function formatDate(dateString) {
        if (!dateString || dateString === 'any' || dateString.includes(' to ')) {
            return dateString;
        }
        const date = new Date(dateString);
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    }

    // Check if dateRange and its properties are defined before formatting
    departDate = dateRange.depart ? formatDate(dateRange.depart) : 'any';
    returnDate = dateRange.return ? formatDate(dateRange.return) : '';

    if (destination === 'Any') {
        endpoint = 'cheapestFlights';
        if (departDate === 'any') {
            apiUrl = `https://yonderhop.com/api/${endpoint}?origin=${origin}`;
        } else if (departDate.includes(' to ')) {
            const [dateFrom, dateTo] = departDate.split(' to ');
            apiUrl = `https://yonderhop.com/api/${endpoint}?origin=${origin}&date_from=${dateFrom}&date_to=${dateTo}`;
        } else {
            apiUrl = `https://yonderhop.com/api/${endpoint}?origin=${origin}&date_from=${departDate}&date_to=${departDate}`;
        }
    } else {
        if (departDate === 'any' || returnDate === 'any') {
            endpoint = 'range';
            apiUrl = `https://yonderhop.com/api/${endpoint}?flyFrom=${origin}&flyTo=${destination}`;
        } else if (departDate.includes(' to ') || returnDate.includes(' to ')) {
            endpoint = 'range';
            const [dateFrom, dateTo] = departDate.includes(' to ') ? departDate.split(' to ') : [departDate, returnDate];
            apiUrl = `https://yonderhop.com/api/${endpoint}?flyFrom=${origin}&flyTo=${destination}&dateFrom=${dateFrom}&dateTo=${dateTo}`;
        } else if (returnDate) {
            endpoint = 'yhreturn';
            apiUrl = `https://yonderhop.com/api/${endpoint}?origin=${origin}&destination=${destination}&departureDate=${departDate}&returnDate=${returnDate}`;
        } else {
            endpoint = 'yhoneway';
            apiUrl = `https://yonderhop.com/api/${endpoint}?origin=${origin}&destination=${destination}&departureDate=${departDate}`;
        }
    }

    console.log("API URL:", apiUrl); // Log the generated API URL

    fetch(apiUrl)
        .then(response => {
            console.log("API Response Status:", response.status); // Log the response status
            if (!response.ok) {
                throw new Error(`Failed to fetch route data: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            console.log("API Response Data:", data); // Log the raw API response data
            let flightsData;

            if (endpoint === 'range' || destination === 'Any') {
                if (data && data.data && Array.isArray(data.data)) {
                    flightsData = data.data;
                } else {
                    console.error("Unexpected data format from API (range or Any):", data);
                    // Handle the error, maybe set flightsData to an empty array or show an error message
                    flightsData = []; // or handle the error in a way that makes sense for your application
                }
            } else { // Handle yhoneway and potentially yhreturn endpoints
                if (Array.isArray(data)) { // Check if data is already an array
                    flightsData = data;
                } else if (data && data.data && Array.isArray(data.data)) { // Check if data.data is an array
                    flightsData = data.data;
                } else {
                    console.error("Unexpected data format from API (yhoneway/yhreturn):", data);
                    // Handle the error, maybe set flightsData to an empty array or show an error message
                    flightsData = []; // or handle the error in a way that makes sense for your application
                }
            }
            console.log("Flights Data:", flightsData); // Log flightsData

            const elements = setupRouteContent(routeIndex);
            const contentWrapper = elements.contentWrapper;
            
            // Keep existing routeBox if present
            const existingRouteBox = contentWrapper.querySelector('#routeBox');
            contentWrapper.innerHTML = ''; // Clear the wrapper
            if (existingRouteBox) {
                contentWrapper.appendChild(existingRouteBox);
            }

            const table = document.createElement('table');
            table.className = 'route-info-table';
            table.dataset.routeIndex = routeIndex;
            table.style.width = '100%';

            const thead = document.createElement('thead');
            thead.innerHTML = `<tr>
                <th data-column="departure">
                    <span class="headerText" data-column="departure">
                    <span class="filteredHeader" data-column="departure">Departure</span>
                    <img class="filterIcon" id="departureFilter" data-column="departure" src="/assets/filter-icon.svg" alt="Filter">
                    <span class="resetIcon" id="resetDepartureFilter" data-column="departure" style="display:none; cursor:pointer;">✕</span>
                    </span>
                    <span class="sortIcon" data-column="departure">&#x21C5;</span>
                </th>
                <th data-column="arrival">
                    <span class="headerText" data-column="arrival">
                    <span class="filteredHeader" data-column="arrival">Arrival</span>
                    <img id="arrivalFilter" class="filterIcon" data-column="arrival" src="/assets/filter-icon.svg" alt="Filter">
                    <span class="resetIcon" id="resetArrivalFilter" data-column="arrival" style="display:none; cursor:pointer;">✕</span>
                    </span>
                    <span class="sortIcon" data-column="arrival">&#x21C5;</span>
                </th>
                <th data-column="price">
                    <span class="headerText" data-column="price">
                    <span class="filteredHeader" data-column="price" id="priceText">Price</span>
                    <img id="priceFilter" class="filterIcon" data-column="price" src="/assets/filter-icon.svg" alt="Filter">
                    <span class="resetIcon" id="resetPriceFilter" data-column="price" style="display:none; cursor:pointer;">✕</span>
                    </span>
                    <span class="sortIcon" data-column="price">&#x21C5;</span>
                </th>
                <th data-column="airlines"><span class="headerText">Airlines</span><span class="sortIcon" data-column="airlines">&#x21C5;</span></th>
                <th data-column="direct"><span class="headerText">Direct</span><span class="sortIcon" data-column="direct">&#x21C5;</span></th>
                <th data-column="stops"><span class="headerText">Stops</span><span class="sortIcon" data-column="stops">&#x21C5;</span></th>
                <th data-column="layovers"><span class="headerText">Layovers</span><span class="sortIcon" data-column="layovers">&#x21C5;</span></th>
                <th data-column="duration"><span class="headerText">Duration</span><span class="sortIcon" data-column="duration">&#x21C5;</span></th>
                <th data-column="route"><span class="headerText">Route</span><span class="sortIcon" data-column="route">&#x21C5;</span></th>
            </tr>`;
            table.appendChild(thead);

            const tbody = document.createElement('tbody');
            flightsData.forEach(flight => {
                let row = document.createElement('tr');
                let departureDate, arrivalDate;
                const routeId = `${flight.flyFrom}-${flight.flyTo}`; // Fix route ID creation
                row.setAttribute('data-route-id', routeId); // Set the route ID as a plain string                
                const directFlight = flight.route.length === 1;
                const price = parseFloat(flight.price.toFixed(2));
                const stops = flight.route.length - 1;
                const layovers = flight.route.slice(0, -1).map(r => r.flyTo).join(", ");
                const durationHours = Math.floor(flight.duration.total / 3600);
                const durationMinutes = Math.floor((flight.duration.total % 3600) / 60);
                const routeIATAs = flight.route.map(r => r.flyFrom).concat(flight.route[flight.route.length - 1].flyTo).join(" > ");

                if (endpoint === 'range' || destination === 'Any') {
                    departureDate = new Date(flight.dTime * 1000);
                    arrivalDate = new Date(flight.aTime * 1000);
                } else {
                    departureDate = new Date(flight.local_departure);
                    arrivalDate = new Date(flight.local_arrival);
                }

                const departureDayName = departureDate.toLocaleDateString('en-US', { weekday: 'short' });
                const arrivalDayName = arrivalDate.toLocaleDateString('en-US', { weekday: 'short' });

                const formattedDeparture = `${departureDayName} ${departureDate.toLocaleString()}`;
                const formattedArrival = `${arrivalDayName} ${arrivalDate.toLocaleString()}`;

                // Convert time to decimal hours for filtering
                const departureTime = departureDate.getHours() + departureDate.getMinutes() / 60;
                const arrivalTime = arrivalDate.getHours() + arrivalDate.getMinutes() / 60;

                row.innerHTML = `<td>${formattedDeparture}</td>
                                 <td>${formattedArrival}</td>
                                 <td>$${price}</td>
                                 <td>${flight.airlines.join(", ")}</td>
                                 <td>${directFlight ? '✓' : ''}</td>
                                 <td>${stops}</td>
                                 <td>${layovers}</td>
                                 <td>${durationHours}h ${durationMinutes}m</td>
                                 <td>${routeIATAs}</td>`;

                // Add parsed data as data attributes for filtering and sorting
                row.dataset.price = price;
                row.dataset.departureTime = departureTime;
                row.dataset.arrivalTime = arrivalTime;

                row.dataset.priceRange = price < 100 ? 'price-range:0-100' :
                    price < 200 ? 'price-range:100-200' :
                    price < 300 ? 'price-range:200-300' :
                    price < 400 ? 'price-range:300-400' :
                    price < 500 ? 'price-range:400-500' :
                    'price-range:500+';
                row.dataset.priceValue = Math.round(price);

                tbody.appendChild(row);

                const tableRouteId = flight.id; // Get the table route ID from the data attribute

                flight.route.forEach((segment, index) => {
                    const originIata = segment.flyFrom;
                    const destinationIata = segment.flyTo;

                    flightMap.getAirportDataByIata(originIata).then(originAirportData => {
                        flightMap.getAirportDataByIata(destinationIata).then(destinationAirportData => {
                            if (!originAirportData || !destinationAirportData) return;

                            pathDrawing.drawLine(`${originIata}-${destinationIata}`, 'route', {
                                price: price,
                                isDirect: directFlight,
                                departureTime: departureTime,
                                arrivalTime: arrivalTime,
                                group: routeIndex + 1, // Assuming each route is a separate group
                                isTableRoute: true,
                                tableRouteId: tableRouteId
                            });
                        });
                    });
                });
            });

            table.appendChild(tbody);
            contentWrapper.appendChild(table); // Append the table once all rows are added
            infoPane.classList.remove('loading');
            pathDrawing.drawLines();
            highlightSelectedRowForRouteIndex(routeIndex);
            attachEventListeners(table, flightsData, routeIndex);
            applyFilters();
        })
        .catch(error => {
            console.error('Error loading data:', error);
            console.error('Detailed error:', error);
            infoPaneContent.textContent = 'Error loading data: ' + error.message;
        });

    function attachEventListeners(table, data, routeIndex) {
        const headers = table.querySelectorAll('th');
        headers.forEach(header => {
            header.style.cursor = 'pointer';
            header.addEventListener('click', function (event) {
                const sortIcon = event.target.closest('.sortIcon');
                if (sortIcon) {
                    const columnIdentifier = sortIcon.getAttribute('data-column');
                    const columnIndex = getColumnIndex(columnIdentifier);
                    const isAscending = sortIcon.getAttribute('data-sort') !== 'asc';
                    sortTableByColumn(table, columnIndex, isAscending);
                    resetSortIcons(headers, sortIcon, isAscending ? 'asc' : 'desc');
                }
            });
        });

        headers.forEach(header => {
            const filteredHeader = header.querySelector('.filteredHeader');
            const filterIcon = header.querySelector('.filterIcon');
            const handleFilterClick = function (event) {
                event.stopPropagation();
                const column = this.getAttribute('data-column');
                if (!column) {
                    console.error('Column attribute is missing on the icon:', this);
                    return;
                }
                const data = fetchDataForColumn(column);
                if (data) {
                    sliderFilter.createFilterPopup(column, data, event);
                } else {
                    console.error('Failed to fetch data for column:', column);
                }
            };

            // Add the 'filter-button' class to the filter buttons
            if (filteredHeader) {
                filteredHeader.classList.add('filter-button');
                filteredHeader.addEventListener('click', handleFilterClick);
            }
            if (filterIcon) {
                filterIcon.classList.add('filter-button');
                filterIcon.addEventListener('click', handleFilterClick);
            }
        });

        document.querySelectorAll('.route-info-table tbody tr').forEach((row, index) => {
            // Add click handler (existing code)
            row.addEventListener('click', function() {
                const routeIdString = this.getAttribute('data-route-id');
                const routeIds = routeIdString.split('|');
                const fullFlightData = data[index];
                routeInfoRow(this, fullFlightData, routeIds, routeIndex);
            });

            // Add hover handlers
            row.addEventListener('mouseover', function() {
                const flight = data[index];
                if (flight && flight.route) {
                    const segments = [];
                    for (let i = 0; i < flight.route.length - 1; i++) {
                        segments.push({
                            from: flight.route[i].flyFrom,
                            to: flight.route[i + 1].flyFrom
                        });
                    }
                    
                    if (flight.route.length > 0) {
                        segments.push({
                            from: flight.route[flight.route.length - 1].flyFrom,
                            to: flight.route[flight.route.length - 1].flyTo
                        });
                    }

                    segments.forEach(segment => {
                        const routeId = `${segment.from}-${segment.to}`;
                        const lines = [
                            ...(pathDrawing.routePathCache[routeId] || []),
                            ...(pathDrawing.dashedRoutePathCache[routeId] || [])
                        ];
                        lines.forEach(line => line instanceof Line && line.highlight());
                    });
                }
            });

            row.addEventListener('mouseout', function() {
                const flight = data[index];
                if (flight && flight.route) {
                    flight.route.forEach((segment, i) => {
                        if (i < flight.route.length) {
                            const routeId = `${segment.flyFrom}-${segment.flyTo}`;
                            const lines = [
                                ...(pathDrawing.routePathCache[routeId] || []),
                                ...(pathDrawing.dashedRoutePathCache[routeId] || [])
                            ];
                            lines.forEach(line => line instanceof Line && line.reset());
                        }
                    });
                }
            });
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
            const priceCells = document.querySelectorAll('.route-info-table tbody tr td:nth-child(' + (getColumnIndex('price') + 1) + ')');
            const prices = Array.from(priceCells)
                .map(cell => parseFloat(cell.textContent.replace(/[^0-9.]/g, '')))
                .filter(price => !isNaN(price));

            if (prices.length === 0) {
                console.error('No valid prices found in the column');
                return { min: 0, max: 0 };
            }

            const min = Math.min(...prices);
            const max = min === Math.max(...prices) ? min + 1 : Math.max(...prices);

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

export { buildRouteTable };
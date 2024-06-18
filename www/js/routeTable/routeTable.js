import { appState, updateState } from '../stateManager.js';
import { sliderFilter } from './sliderFilter.js';
import { sortTableByColumn } from './sortTable.js';
import { pathDrawing } from '../pathDrawing.js';
import { flightMap } from '../flightMap.js';
import { routeInfoRow, highlightSelectedRowForRouteIndex } from './routeInfoRow.js';

function buildRouteTable(routeIndex) {
    appState.filterState = {
        departure: { start: 0, end: 24 },
        arrival: { start: 0, end: 24 }
    };

    const dateRange = appState.routeDates[routeIndex];
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
    topBar.classList.add('loading');
    
    if (destination === 'Any') {
        endpoint = 'cheapestFlights';
        origin = appState.waypoints[routeIndex * 2]?.iata_code;
    } else {
        origin = currentRoute.originAirport.iata_code;
    }

    if (!dateRange) {
        console.error('No date range found');
        return;
    }

    departDate = dateRange.depart || '';
    returnDate = dateRange.return || '';

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

    fetch(apiUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Failed to fetch route data: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            const table = document.createElement('table');
            table.className = 'route-info-table';
            table.style.width = '100%';
            table.setAttribute('data-route-index', routeIndex);

            const thead = document.createElement('thead');
            let headerRow = `<tr>
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
            thead.innerHTML = headerRow;
            table.appendChild(thead);

            const tbody = document.createElement('tbody');

            if (endpoint === 'range' || destination === 'Any') {
                data = data.data;
            }
            data.forEach(flight => {
                let row = document.createElement('tr');
                let departureDate, arrivalDate;
                row.setAttribute('data-route-id', flight.id);
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

                row.innerHTML = `<td>${formattedDeparture}</td>
                                 <td>${formattedArrival}</td>
                                 <td>$${price}</td>
                                 <td>${flight.airlines.join(", ")}</td>
                                 <td>${directFlight ? '✓' : ''}</td>
                                 <td>${stops}</td>
                                 <td>${layovers}</td>
                                 <td>${durationHours}h ${durationMinutes}m</td>
                                 <td>${routeIATAs}</td>`;
                tbody.appendChild(row);

                const tableRouteId = flight.id; // Get the table route ID from the data attribute

                flight.route.forEach((segment, index) => {
                    const originIata = segment.flyFrom;
                    const destinationIata = segment.flyTo;
                    
                    flightMap.getAirportDataByIata(originIata).then(originAirportData => {
                        flightMap.getAirportDataByIata(destinationIata).then(destinationAirportData => {
                            if (!originAirportData || !destinationAirportData) return;
            
                            pathDrawing.createRoutePath(originAirportData, destinationAirportData, {
                                originAirport: originAirportData,
                                destinationAirport: destinationAirportData,
                                price: price,
                            }, null, true, tableRouteId);
                        });
                    });
                });
            });
            table.appendChild(tbody);
            infoPaneContent.appendChild(table);
            topBar.classList.remove('loading');
            pathDrawing.drawRouteLines();
            highlightSelectedRowForRouteIndex(routeIndex);
            attachEventListeners(table, data, routeIndex);
        })
        .catch(error => {
            infoPaneContent.textContent = 'Error loading data: ' + error.message;
        });

    function attachEventListeners(table, data, routeIndex) {
        const headers = table.querySelectorAll('th');
        headers.forEach(header => {
            header.style.cursor = 'pointer';
            header.addEventListener('click', function(event) {
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
            const handleFilterClick = function(event) {
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
    
            if (filteredHeader) {
                filteredHeader.addEventListener('click', handleFilterClick);
            }
            if (filterIcon) {
                filterIcon.addEventListener('click', handleFilterClick);
            }
        });
    
        document.querySelectorAll('.route-info-table tbody tr').forEach((row, index) => {
            row.addEventListener('click', function() {
                const routeIdString = this.getAttribute('data-route-id');
                const routeIds = routeIdString.split('|');
                const fullFlightData = data[index];
                routeInfoRow(this, fullFlightData, routeIds, routeIndex);
            });
        });
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

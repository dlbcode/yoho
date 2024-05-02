import { appState, updateState } from '../stateManager.js';
import { sliderFilter } from './sliderFilter.js';
import { sortTableByColumn } from './sortTable.js';
import { pathDrawing } from '../pathDrawing.js';
import { flightMap } from '../flightMap.js';
import { routeInfoRow, highlightSelectedRowForRouteIndex } from './routeInfoRow.js';

function newBuildRouteTable(routeIndex, dateRange = null) {
  
  let currentRoute, startDate, endDate, departureDate;
  if (!currentRoute) {
    if (dateRange) {
      console.log('dateRange:', routeIndex, dateRange);
      [startDate, endDate] = dateRange.split(' to ');
      currentRoute = appState.routes[routeIndex];  // Assign to already declared currentRoute
      console.log(appState.routes[routeIndex]);
      console.log('currentRoute 1: ', currentRoute);
    } else {
      console.log('SingleDate:', routeIndex);
      departureDate = appState.routeDates[routeIndex];
      currentRoute = appState.routes && appState.routes.length > routeIndex ? appState.routes[routeIndex] : undefined;  // Assign to already declared currentRoute
    }
    console.log('currentRoute 2:', currentRoute);
  
    if (!currentRoute) {
      document.querySelector('#infoPaneContent').textContent = 'Please select a route to display data.';
      return;
    }
  }
  

  document.head.appendChild(Object.assign(document.createElement('link'), {rel: 'stylesheet', type: 'text/css', href: '../css/routeTable.css'}));

  // Start the loading animation
  const topBar = document.getElementById('top-bar');
  topBar.classList.add('loading');

  let origin, destination;

// Assign values first before using them in the apiUrl.
origin = currentRoute.originAirport.iata_code;
destination = currentRoute.destinationAirport.iata_code;

let apiUrl = `https://yonderhop.com/api/range?flyFrom=${origin}&flyTo=${destination}`;

if (dateRange) {
  if (!dateRange.includes('any')) {
    console.log('dateRange:', dateRange);
    const [startDate, endDate] = dateRange.split(' to ');  // Ensure these are declared and accessible here
    apiUrl += `&dateFrom=${startDate}&dateTo=${endDate}`;
  } else {
    console.log('Any date range');
    apiUrl = `https://yonderhop.com/api/range?flyFrom=${origin}&flyTo=${destination}`;
  }
} else {
  console.log('Single date:', departureDate);
  apiUrl = `https://yonderhop.com/api/yhoneway?origin=${origin}&destination=${destination}&departureDate=${departureDate}`;
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
      table.setAttribute('data-route-index', routeIndex, 'border', '1');

      const thead = document.createElement('thead');
      let headerRow = `<tr>
                    <th data-column="departure">Departure <span class="sortIcon" data-column="departure">&#x21C5;</span><img class="filterIcon" id="departureFilter"data-column="departure" src="/assets/filter-icon.svg" alt="Filter"></th>
                    <th data-column="arrival">Arrival <span class="sortIcon" data-column="arrival">&#x21C5;</span><img id="arrivalFilter" class="filterIcon" data-column="arrival" src="/assets/filter-icon.svg" alt="Filter"></th>
                    <th data-column="price"><span id="priceText">Price</span><span class="sortIcon" data-column="price">&#x21C5;</span><img id="priceFilter" class="filterIcon" data-column="price" src="/assets/filter-icon.svg" alt="Filter"></th>
                    <th data-column="airlines">Airlines <span class="sortIcon" data-column="airlines">&#x21C5;</span></th>
                    <th data-column="direct">Direct <span class="sortIcon" data-column="direct">&#x21C5;</span></th>
                    <th data-column="stops">Stops <span class="sortIcon" data-column="stops">&#x21C5;</span></th>
                    <th data-column="layovers">Layovers <span class="sortIcon" data-column="layovers">&#x21C5;</span></th>
                    <th data-column="duration">Duration <span class="sortIcon" data-column="duration">&#x21C5;</span></th>
                    <th data-column="route">Route <span class="sortIcon" data-column="route">&#x21C5;</span></th>
                 </tr>`;
      thead.innerHTML = headerRow;
      table.appendChild(thead);

      const tbody = document.createElement('tbody');

      console.log('dateRange 1:', dateRange);

      if (dateRange) {
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
        console.log('dateRange 2:', dateRange);
        if (dateRange) {
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
              if (sortIcon) {  // This checks if the clicked element is the sortIcon itself
                  const columnIdentifier = sortIcon.getAttribute('data-column');
                  const columnIndex = getColumnIndex(columnIdentifier);
                  const isAscending = sortIcon.getAttribute('data-sort') !== 'asc';
                  sortTableByColumn(table, columnIndex, isAscending);
                  resetSortIcons(headers, sortIcon, isAscending ? 'asc' : 'desc');
              }
          });
      });  

      document.querySelectorAll('.filterIcon').forEach(icon => {
        icon.addEventListener('click', function(event) {
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
        });
    });
 
    function fetchDataForColumn(column) {
      switch (column) {
          case 'price':
              const priceCells = document.querySelectorAll('.route-info-table tbody tr td:nth-child(' + (getColumnIndex('price') + 1) + ')');
              const prices = Array.from(priceCells).map(cell => {
                  const priceText = cell.textContent.replace(/[^\d.]/g, ''); // Remove any non-numeric characters, including the dollar sign
                  return parseFloat(priceText);
              }).filter(price => !isNaN(price)); // Ensure only valid numbers are included
  
              if (prices.length === 0) {
                  console.error('No valid prices found in the column');
                  return { min: 0, max: 0 }; // Return default or error values if no prices are found
              }
  
              const min = Math.min(...prices);
              const max = Math.max(...prices);
              return { min, max };
  
          case 'departure':
          case 'arrival':
              return {
                  min: 0,
                  max: 24
              };
  
          default:
              console.error('Unsupported column:', column);
              return null;
      }
  }
      document.querySelectorAll('.route-info-table tbody tr').forEach((row, index) => {
        row.addEventListener('click', function() {
          const routeIdString = this.getAttribute('data-route-id');
          const routeIds = routeIdString.split('|');
          const fullFlightData = data[index];
          routeInfoRow(this, fullFlightData, routeIds, routeIndex);
        });
    });    
    
    document.querySelectorAll('.route-info-table tbody tr').forEach(row => {
      row.addEventListener('mouseover', function() {
        const routeString = this.cells[8].textContent.trim();
        const iataCodes = routeString.split(' > ');
  
        for (let i = 0; i < iataCodes.length - 1; i++) {
            const originIata = iataCodes[i];
            const destinationIata = iataCodes[i + 1];
            pathDrawing.drawPathBetweenAirports(originIata, destinationIata, flightMap.getAirportDataByIata);
        }
      });
  
      row.addEventListener('mouseout', function() {
          pathDrawing.clearLines();
          pathDrawing.drawLines();
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
}

export { newBuildRouteTable };
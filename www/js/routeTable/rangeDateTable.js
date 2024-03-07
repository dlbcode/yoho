import { appState, updateState } from '../stateManager.js';
import { showPriceFilterPopup } from './priceFilter.js';
import { showDateFilterPopup } from './dateFilters.js';
import { pathDrawing } from '../pathDrawing.js';
import { flightMap } from '../flightMap.js';

function getColumnIndex(columnIdentifier) {
  const columnMap = {
    'departure': 1,
    'arrival': 2,
    'price': 3,
    'airlines': 4,
    'direct': 5,
    'stops': 6,
    'layovers': 7,
    'duration': 8,
    'route': 9
  };
  return columnMap[columnIdentifier] || -1; // Default to -1 if identifier not found
}

function buildDateRangeTable(routeIndex, dateRange) {
  const [startDate, endDate] = dateRange.split(' to ');
  const currentRoute = appState.routes[routeIndex];
  const infoPaneContent = document.getElementById('infoPaneContent');
  infoPaneContent.innerHTML = '';

  if (!currentRoute) {
    return;
  }

  document.head.appendChild(Object.assign(document.createElement('link'), {rel: 'stylesheet', type: 'text/css', href: '../css/routeTable.css'}));

  const origin = currentRoute.originAirport.iata_code;
  const destination = currentRoute.destinationAirport.iata_code;

  let apiUrl = `https://yonderhop.com/api/range?flyFrom=${origin}&flyTo=${destination}&dateFrom=${startDate}&dateTo=${endDate}`;

  console.log('apiUrl:', apiUrl);

  fetch(apiUrl)
  .then(response => {
    if (!response.ok) {
      throw new Error(`Failed to fetch route data: ${response.statusText}`);
    }
    return response.json();
  })
  .then(responseData => {
    const flightsData = responseData.data; // Access the 'data' array from the response
    if (!Array.isArray(flightsData)) {
      throw new Error('Expected an array of data');
    }

    // Proceed to use flightsData as an array
    const table = document.createElement('table');
    table.className = 'route-info-table';
    table.style.width = '100%';
    table.setAttribute('data-route-index', routeIndex, 'border', '1');

    const thead = document.createElement('thead');
    let headerRow = `<tr>
                      <th>Departure</th>
                      <th>Arrival</th>
                      <th>Price</th>
                      <th>Airlines</th>
                      <th>Duration</th>
                      <th>Distance</th>
                      <th>Stops</th>
                   </tr>`;
    thead.innerHTML = headerRow;
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    flightsData.forEach(flight => {
      let row = document.createElement('tr');
      row.setAttribute('data-route-id', flight.id);
      const stops = flight.route.length - 1;
      row.innerHTML = `<td>${new Date(flight.dTime * 1000).toLocaleString()}</td>
                       <td>${new Date(flight.aTime * 1000).toLocaleString()}</td>
                       <td>$${flight.price}</td>
                       <td>${flight.airlines.join(", ")}</td>
                       <td>${flight.fly_duration}</td>
                       <td>${flight.distance} km</td>
                       <td>${stops}</td>`;
      tbody.appendChild(row);
    });
    table.appendChild(tbody);
    infoPaneContent.appendChild(table);

    attachEventListeners(table, flightsData, routeIndex);
  })
  .catch(error => {
    infoPaneContent.textContent = 'Error loading data: ' + error.message;
  });
}

function attachEventListeners(table, data, routeIndex) {
  const headers = table.querySelectorAll('th');
  headers.forEach(header => {
    header.style.cursor = 'pointer';
    header.addEventListener('click', function(event) {
      // Prevent sorting/filtering when clicking on filter or sort icons directly
      if (!event.target.closest('.filterIcon') && !event.target.closest('.sortIcon')) {
        const columnIdentifier = this.textContent.toLowerCase();
        const columnIndex = getColumnIndex(columnIdentifier);
        if (columnIndex !== -1) {
          const isAscending = this.classList.contains('asc');
          sortTableByColumn(table, columnIndex, !isAscending);
          updateSortAndFilterIcons(headers, columnIndex, isAscending);
        }
      }
    });
  });

  // Example implementation for sortTableByColumn function
  function sortTableByColumn(table, columnIndex, asc = true) {
    const dirModifier = asc ? 1 : -1;
    const tBody = table.tBodies[0];
    const rows = Array.from(tBody.querySelectorAll("tr"));

    // Sorting logic based on column data type
    const sortedRows = rows.sort((a, b) => {
      let aColText = a.querySelector(`td:nth-child(${columnIndex + 1})`).textContent.trim().toLowerCase();
      let bColText = b.querySelector(`td:nth-child(${columnIndex + 1})`).textContent.trim().toLowerCase();
      // Handle numeric and date comparisons specifically
      if (!isNaN(parseFloat(aColText)) && !isNaN(parseFloat(bColText))) {
        return (parseFloat(aColText) - parseFloat(bColText)) * dirModifier;
      } else {
        return aColText.localeCompare(bColText) * dirModifier;
      }
    });

    while (tBody.firstChild) {
      tBody.removeChild(tBody.firstChild);
    }
    tBody.append(...sortedRows);

    // Update sort direction class
    headers.forEach(header => {
      header.classList.remove('asc', 'desc');
    });
    table.querySelector(`th:nth-child(${columnIndex + 1})`).classList.add(asc ? 'asc' : 'desc');
  }

  // Example implementation for updateSortAndFilterIcons function
  function updateSortAndFilterIcons(headers, sortedColumnIndex, isAscending) {
    headers.forEach((header, index) => {
      const sortIcon = header.querySelector('.sortIcon');
      if (sortIcon) {
        if (index === sortedColumnIndex) {
          sortIcon.textContent = isAscending ? '▼' : '▲'; // Update icon based on sort direction
        } else {
          sortIcon.textContent = '⇅'; // Reset icon for non-sorted columns
        }
      }
    });
  }

  // Add any additional event listeners for filtering if applicable
}

export { buildDateRangeTable, attachEventListeners };

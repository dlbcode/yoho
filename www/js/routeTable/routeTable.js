import { appState } from '../stateManager.js';
import { showPriceFilterPopup } from './priceFilter.js';
import { showDateFilterPopup } from './dateFilters.js';

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

function buildRouteTable(routeIndex) {
  const selectedRoute = appState.routes[routeIndex];
  const infoPaneContent = document.getElementById('infoPaneContent');
  infoPaneContent.innerHTML = '';

  // Load routeTable.css
  document.head.appendChild(Object.assign(document.createElement('link'), {rel: 'stylesheet', type: 'text/css', href: '../css/routeTable.css'}));

  const origin = selectedRoute.originAirport.iata_code;
  const destination = selectedRoute.destinationAirport.iata_code;
  const date = "2024-03-15";

  fetch(`https://yonderhop.com/api/yhoneway?origin=${origin}&destination=${destination}&date=${date}`)
    .then(response => {
      if (!response.ok) {
        throw new Error('Failed to fetch route data');
      }
      return response.json();
    })
    .then(data => {
      const table = document.createElement('table');
      table.className = 'route-info-table';
      table.style.width = '100%';
      table.setAttribute('border', '1');

      const thead = document.createElement('thead');
      let headerRow = `<tr>
                    <th>Departure <span class="sortIcon" data-column="departure">&#x21C5;</span><img class="filterIcon" data-column="departure" src="/assets/filter-icon.svg" alt="Filter"></th>
                    <th>Arrival <span class="sortIcon" data-column="arrival">&#x21C5;</span><img class="filterIcon" data-column="arrival" src="/assets/filter-icon.svg" alt="Filter"></th>
                    <th>Price <span class="sortIcon" data-column="price">&#x21C5;</span><img id="priceFilter" class="filterIcon" src="/assets/filter-icon.svg" alt="Filter"></th>
                    <th>Airlines <span class="sortIcon" data-column="airlines">&#x21C5;</span></th>
                    <th>Direct <span class="sortIcon" data-column="direct">&#x21C5;</span></th>
                    <th>Stops <span class="sortIcon" data-column="stops">&#x21C5;</span></th>
                    <th>Layovers <span class="sortIcon" data-column="layovers">&#x21C5;</span></th>
                    <th>Duration <span class="sortIcon" data-column="duration">&#x21C5;</span></th>
                    <th>Route <span class="sortIcon" data-column="route">&#x21C5;</span></th>
                 </tr>`;
      thead.innerHTML = headerRow;
      table.appendChild(thead);

      const tbody = document.createElement('tbody');
      data.forEach(flight => {
        let row = document.createElement('tr');
        const directFlight = flight.route.length === 1;
        const stops = flight.route.length - 1;
        const layovers = flight.route.slice(1, -1).map(r => r.flyTo).join(", ");
        const durationHours = Math.floor(flight.duration.total / 3600);
        const durationMinutes = Math.floor((flight.duration.total % 3600) / 60);
        const routeIATAs = flight.route.map(r => r.flyFrom).concat(flight.route[flight.route.length - 1].flyTo).join(" > ");
        row.innerHTML = `<td>${new Date(flight.local_departure).toLocaleString()}</td>
                         <td>${new Date(flight.local_arrival).toLocaleString()}</td>
                         <td>$${flight.price}</td>
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

      attachEventListenersToIcons(table, data);
    })
    .catch(error => {
      console.error('Error:', error);
      infoPaneContent.textContent = 'Error loading data.';
    });
}

function attachEventListenersToIcons(table, data) {
  const headers = table.querySelectorAll('th');
  headers.forEach(header => {
    header.style.cursor = 'pointer'; // Ensure the cursor indicates clickable headers
    header.addEventListener('click', function(event) {
      // Check if the click is on the filter icon or a child of it
      if (!event.target.closest('.filterIcon')) {
        const sortIcon = this.querySelector('.sortIcon');
        const columnIdentifier = sortIcon.getAttribute('data-column');
        const columnIndex = getColumnIndex(columnIdentifier);
        const isAscending = sortIcon.getAttribute('data-sort') !== 'asc';
        sortTableByColumn(table, columnIndex, isAscending);
        resetSortIcons(headers, sortIcon, isAscending ? 'asc' : 'desc');
      }
    });
  });

  // Attach event listeners specifically for date filter icons
  document.querySelectorAll('.filterIcon').forEach(icon => {
    icon.addEventListener('click', function(event) {
      event.stopPropagation(); // Prevent the event from bubbling up to the header
      const column = this.getAttribute('data-column');
      if (column === 'departure' || column === 'arrival') {
        const dateFilterPopup = document.getElementById(`${column}DateFilterPopup`);
        if (dateFilterPopup) {
          // Toggle visibility of the date filter popup
          dateFilterPopup.classList.toggle('hidden');
        } else {
          // Show the date filter popup if it doesn't exist yet
          showDateFilterPopup(event, column);
        }
      }
    });
  });

  // Separate handling for the price filter icon
  const priceFilterIcon = document.getElementById('priceFilter');
  if (priceFilterIcon) {
    priceFilterIcon.addEventListener('click', function(event) {
      event.stopPropagation(); // Prevent the event from affecting other elements
      const priceSliderPopup = document.getElementById('priceSliderPopup');
      if (priceSliderPopup) {
        // Correctly toggle the 'hidden' class to show/hide the price filter popup
        priceSliderPopup.classList.toggle('hidden');
      } else {
        // Invoke the function to show the price filter popup if it's not already created
        // Ensure that `data` or any required parameter is correctly passed to `showPriceFilterPopup`
        showPriceFilterPopup(event, data); // Make sure `data` is defined and accessible in this scope
      }
    });
  }
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

function sortTableByColumn(table, columnIndex, asc = true) {
  const dirModifier = asc ? 1 : -1;
  const tBody = table.tBodies[0];
  const rows = Array.from(tBody.querySelectorAll("tr"));

  const sortedRows = rows.sort((a, b) => {
    let aColText = a.cells[columnIndex - 1].textContent.trim();
    let bColText = b.cells[columnIndex - 1].textContent.trim();
    return aColText.localeCompare(bColText, undefined, { numeric: true }) * dirModifier;
  });

  while (tBody.firstChild) {
    tBody.removeChild(tBody.firstChild);
  }
  tBody.append(...sortedRows);

  // Update header classes for visual indication of sort direction
  table.querySelectorAll("th").forEach(th => th.classList.remove("th-sort-asc", "th-sort-desc"));
  if (asc) {
    table.querySelector(`th:nth-child(${columnIndex})`).classList.add("th-sort-asc");
  } else {
    table.querySelector(`th:nth-child(${columnIndex})`).classList.add("th-sort-desc");
  }
}

export { buildRouteTable };

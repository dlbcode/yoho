import { appState } from '../stateManager.js';
import { showPriceFilterPopup } from './priceFilter.js';

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
                          <th>Departure <span class="sortIcon" data-column="departure"></span></th>
                          <th>Arrival <span class="sortIcon" data-column="arrival"></span></th>
                          <th>Price <span class="sortIcon" data-column="price"></span><img id=priceFilter class="filterIcon" src="/assets/filter-icon.svg" alt="Filter"></th>
                          <th>Airlines <span class="sortIcon" data-column="airlines"></span></th>
                          <th>Direct <span class="sortIcon" data-column="direct"></span></th>
                          <th>Stops <span class="sortIcon" data-column="stops"></span></th>
                          <th>Layovers <span class="sortIcon" data-column="layovers"></span></th>
                          <th>Duration <span class="sortIcon" data-column="duration"></span></th>
                          <th>Route <span class="sortIcon" data-column="route"></span></th>
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
  const sortIcons = document.querySelectorAll('.sortIcon');
  sortIcons.forEach(icon => {
    icon.addEventListener('click', function() {
      const columnIdentifier = this.getAttribute('data-column');
      const columnIndex = getColumnIndex(columnIdentifier);
      const isAscending = this.getAttribute('data-sort') !== 'asc';
      sortTableByColumn(table, columnIndex, isAscending);
      resetSortIcons(sortIcons);
      this.classList.toggle('asc', isAscending);
      this.classList.toggle('desc', !isAscending);
      this.setAttribute('data-sort', isAscending ? 'asc' : 'desc');
    });
  });

  const priceFilterIcon = document.getElementById('priceFilter');
  priceFilterIcon.addEventListener('click', function(event) {
    event.stopPropagation();
    const priceSliderPopup = document.getElementById('priceSliderPopup');
    if (priceSliderPopup) {
      // Toggle the popup's visibility
      priceSliderPopup.classList.toggle('hidden');
    } else {
      // If the popup doesn't exist, show it for the first time
      showPriceFilterPopup(event, data);
    }
  });
}

function resetSortIcons(sortIcons) {
  sortIcons.forEach(icon => {
    // Remove sort state classes from all icons except the one being activated
    icon.classList.remove('asc', 'desc');
    icon.removeAttribute('data-sort');
  });
}

function sortTableByColumn(table, columnIndex, asc = true) {
  const dirModifier = asc ? 1 : -1;
  const tBody = table.tBodies[0];
  const rows = Array.from(tBody.querySelectorAll("tr"));

  const sortedRows = rows.sort((a, b) => {
    let aColText = a.cells[columnIndex - 1].textContent.trim();
    let bColText = b.cells[columnIndex - 1].textContent.trim();

    if (!isNaN(parseFloat(aColText)) && !isNaN(parseFloat(bColText))) {
      return (parseFloat(aColText) - parseFloat(bColText)) * dirModifier;
    }
    // Default to string comparison
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

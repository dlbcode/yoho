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

function buildRouteTable(routeIndex) {
  const currentRoute = appState.routes[routeIndex];
  const infoPaneContent = document.getElementById('infoPaneContent');
  infoPaneContent.innerHTML = '';

  if (!currentRoute) {
      console.error('No route data available for routeIndex:', routeIndex);
      infoPaneContent.textContent = 'No route data available.';
      return;
  }

  document.head.appendChild(Object.assign(document.createElement('link'), {rel: 'stylesheet', type: 'text/css', href: '../css/routeTable.css'}));

  const origin = currentRoute.originAirport.iata_code;
  const destination = currentRoute.destinationAirport.iata_code;
  const routeNumber = (routeIndex + 1);
  const currentRouteDate = appState.routeDates[routeNumber];
  const date = currentRouteDate ? currentRouteDate : appState.startDate;


  fetch(`https://yonderhop.com/api/yhoneway?origin=${origin}&destination=${destination}&date=${date}`)
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
        row.setAttribute('data-route-id', flight.id);
        const directFlight = flight.route.length === 1;
        const stops = flight.route.length - 1;
        const layovers = flight.route.slice(0, -1).map(r => r.flyTo).join(", ");
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

      highlightSelectedRowForRouteIndex(routeIndex);

      attachEventListeners(table, data, routeIndex);
    })
    .catch(error => {
      console.error('API Request Failed:', error);
      infoPaneContent.textContent = 'Error loading data: ' + error.message;
    });
}

function attachEventListeners(table, data, routeIndex) {
  const headers = table.querySelectorAll('th');
  headers.forEach(header => {
    header.style.cursor = 'pointer';
    header.addEventListener('click', function(event) {
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
          dateFilterPopup.classList.toggle('hidden');
        } else {
          showDateFilterPopup(event, column);
        }
      }
    });
  });
   
  document.querySelectorAll('.route-info-table tbody tr').forEach((row, index) => {
    row.addEventListener('click', function() {
        const routeIdString = this.getAttribute('data-route-id');
        const routeIds = routeIdString.split('|');
        const fullFlightData = data[index];

        // Determine the group ID of the newly selected route
        let newRouteGroupId = null;
        const routeDetails = appState.selectedRoutes[routeIndex];
        if (routeDetails) {
            newRouteGroupId = routeDetails.group;
        }

        // Remove all selected routes that have the same group ID
        if (newRouteGroupId !== null) {
            Object.keys(appState.selectedRoutes).forEach(key => {
                if (appState.selectedRoutes[key].group === newRouteGroupId) {
                    updateState('removeSelectedRoute', parseInt(key));
                }
            });
        }

        // Add the new selected route(s)
        routeIds.forEach((id, idx) => {
            const currentRouteIndex = routeIndex + idx;
            const displayData = {
                departure: new Date(fullFlightData.local_departure).toLocaleString(),
                arrival: new Date(fullFlightData.local_arrival).toLocaleString(),
                price: `$${fullFlightData.price}`,
                airline: fullFlightData.airlines.join(", "),
                stops: fullFlightData.route.length - 1,
                route: fullFlightData.route.map(segment => `${segment.flyFrom} > ${segment.flyTo}`).join(", "),
                deep_link: fullFlightData.deep_link
            };

            updateState('updateSelectedRoute', {
                routeIndex: currentRouteIndex,
                routeDetails: {
                    id: id,
                    fullData: fullFlightData,
                    displayData: displayData,
                    group: routeIndex // Assuming the routeIndex is used as the group identifier
                }
            });
            updateState('changeView', 'selectedRoute');
        });

        highlightSelectedRowForRouteIndex(routeIndex);
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

  document.querySelectorAll('.route-info-table tbody tr').forEach((row) => {
    row.addEventListener('click', function() {
        const routeString = this.cells[8].textContent.trim(); // Assuming the IATA codes are in the 9th column
        const iataCodes = routeString.split(' > ');
        replaceWaypointsForCurrentRoute(iataCodes, routeIndex);
    });
  });

  // Separate handling for the price filter icon
  const priceFilterIcon = document.getElementById('priceFilter');
  if (priceFilterIcon) {
    priceFilterIcon.addEventListener('click', function(event) {
      event.stopPropagation(); // Prevent the event from affecting other elements
      const priceSliderPopup = document.getElementById('priceSliderPopup');
      if (priceSliderPopup) {
        priceSliderPopup.classList.toggle('hidden');
      } else {
        showPriceFilterPopup(event, data);
      }
    });
  }
}

function highlightSelectedRowForRouteIndex(routeIndex) {
  // First, clear any previous selection for this route index
  document.querySelectorAll(`.route-info-table[data-route-index="${routeIndex}"] tbody tr.selected`).forEach(row => {
      row.classList.remove('selected');
  });

  // Get the selected route ID for this route index
  const selectedRouteDetails = appState.selectedRoutes[routeIndex];
  if (selectedRouteDetails && selectedRouteDetails.id) { // Corrected this line
      // Find and highlight the row with the matching route ID within this route index
      const selectedRow = document.querySelector(`.route-info-table[data-route-index="${routeIndex}"] tbody tr[data-route-id="${selectedRouteDetails.id}"]`);
      if (selectedRow) {
          selectedRow.classList.add('selected');
      }
  }
}

function replaceWaypointsForCurrentRoute(intermediaryIatas, routeIndex) {
  const startIndex = routeIndex * 2;
  let before = appState.waypoints.slice(0, startIndex);
  let after = appState.waypoints.slice((routeIndex + 1) * 2);

  // Initialize the updated segment with the first intermediary waypoint as the starting point
  let updatedSegment = [flightMap.airportDataCache[intermediaryIatas[0]]];

  // Add each intermediary waypoint as the destination, and then as the origin of the next leg
  for (let i = 1; i < intermediaryIatas.length; i++) {
      let airportData = flightMap.airportDataCache[intermediaryIatas[i]];
      updatedSegment.push(airportData); // Add as destination of the current leg
      if (i < intermediaryIatas.length - 1) {
          // If not the last intermediary, also add as origin of the next leg
          updatedSegment.push(airportData);
      }
  }

  // Ensure the final destination is added if it's not already the last item in the updated segment
  const finalDestinationIata = intermediaryIatas[intermediaryIatas.length - 1];
  if (updatedSegment[updatedSegment.length - 1].iata_code !== finalDestinationIata) {
      updatedSegment.push(flightMap.airportDataCache[finalDestinationIata]);
  }

  // Reassemble the waypoints array
  appState.waypoints = [...before, ...updatedSegment, ...after];

  // Notify the application of the waypoints update
  updateState('updateWaypoint', appState.waypoints);
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

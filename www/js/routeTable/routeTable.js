import { appState, updateState } from '../stateManager.js';
import { showPriceFilterPopup } from './priceFilter.js';
import { showDateFilterPopup } from './dateFilters.js';
import { pathDrawing } from '../pathDrawing.js';
import { flightMap } from '../flightMap.js';

function buildRouteTable(routeIndex) {
  const currentRoute = appState.routes[routeIndex];
  const infoPaneContent = document.getElementById('infoPaneContent');
  infoPaneContent.innerHTML = '';

  if (!currentRoute) {
      return;
  }

  document.head.appendChild(Object.assign(document.createElement('link'), {rel: 'stylesheet', type: 'text/css', href: '../css/routeTable.css'}));

  const origin = currentRoute.originAirport.iata_code;
  const destination = currentRoute.destinationAirport.iata_code;
  const routeNumber = (routeIndex + 1);
  let apiUrl = `https://yonderhop.com/api/`;

  // Extracting startDate and endDate from appState.routeDates[routeNumber]
  const dateRange = appState.routeDates[routeNumber];
  if (dateRange && dateRange.includes(' to ')) {
    const [startDate, endDate] = dateRange.split(' to ');
    apiUrl += `range?flyFrom=${origin}&flyTo=${destination}&dateFrom=${startDate}&dateTo=${endDate}`;
  } else {
    // Fallback to existing logic for single dates or round trips
    const departureDate = appState.routeDates[routeNumber];
    apiUrl += `${appState.roundTrip ? 'yhreturn' : 'yhoneway' }?origin=${origin}&destination=${destination}&departureDate=${departureDate}`;
    if (appState.roundTrip) {
      const returnDate = appState.routeDates[2];
      apiUrl += `&returnDate=${returnDate}`;
    }
  }
  console.log(apiUrl);
  fetch(apiUrl)
  .then(response => response.json())
  .then(responseData => {
    // Determine if the response is for a date range or a single flight based on the presence of the 'data' field
    const flightsData = Array.isArray(responseData) ? responseData : responseData.data;

  const table = document.createElement('table');
  table.className = 'route-info-table';
  table.style.width = '100%';
  const thead = document.createElement('thead');
  let headerRow = `<tr>
                    <th>Departure</th>
                    <th>Arrival</th>
                    <th>Price</th>
                    <th>Airlines</th>
                    <th>Direct</th>
                    <th>Stops</th>
                    <th>Layovers</th>
                    <th>Duration</th>
                    <th>Route</th>
                   </tr>`;
  thead.innerHTML = headerRow;
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  flightsData.forEach(flight => {
    let row = document.createElement('tr');
    // Handle departure and arrival times for both single and range date queries
    let departureTime = flight.local_departure ? new Date(flight.local_departure).toLocaleString() : new Date(flight.dTime * 1000).toLocaleString();
    let arrivalTime = flight.local_arrival ? new Date(flight.local_arrival).toLocaleString() : new Date(flight.aTime * 1000).toLocaleString();

    row.innerHTML = `<td>${departureTime}</td>
                     <td>${arrivalTime}</td>
                     <td>$${flight.price}</td>
                     <td>${flight.airlines.join(", ")}</td>
                     <td>${flight.route.length === 1 ? 'Yes' : 'No'}</td>
                     <td>${flight.route.length - 1}</td>
                     <td>${flight.route.map(r => r.flyTo).join(", ")}</td>
                     <td>${Math.floor(flight.duration.total / 3600)}h ${Math.floor((flight.duration.total % 3600) / 60)}m</td>
                     <td>${flight.route.map(r => `${r.flyFrom} > ${r.flyTo}`).join(", ")}</td>`;
    tbody.appendChild(row);
  });
  table.appendChild(tbody);
  infoPaneContent.appendChild(table);
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
  // Adjust startIndex for round trips to ensure the entire waypoints array is considered
  const startIndex = appState.roundTrip ? 0 : routeIndex * 2;
  let before = appState.waypoints.slice(0, startIndex);
  let after = appState.roundTrip ? [] : appState.waypoints.slice((routeIndex + 1) * 2);

  let updatedSegment = [flightMap.airportDataCache[intermediaryIatas[0]]];

  for (let i = 1; i < intermediaryIatas.length; i++) {
      let airportData = flightMap.airportDataCache[intermediaryIatas[i]];
      updatedSegment.push(airportData);
      if (i < intermediaryIatas.length - 1) {
          updatedSegment.push(airportData);
      }
  }

  // For round trips, ensure the return to the origin is explicitly handled
  if (appState.roundTrip) {
      const originIata = intermediaryIatas[0];
      if (updatedSegment[updatedSegment.length - 1].iata_code !== originIata) {
          updatedSegment.push(flightMap.airportDataCache[originIata]);
      }
  } else {
      // For non-round trips, ensure the final destination is added if not already present
      const finalDestinationIata = intermediaryIatas[intermediaryIatas.length - 1];
      if (updatedSegment[updatedSegment.length - 1].iata_code !== finalDestinationIata) {
          updatedSegment.push(flightMap.airportDataCache[finalDestinationIata]);
      }
  }

  appState.waypoints = [...before, ...updatedSegment, ...after];
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

import { appState, updateState } from '../stateManager.js';
import { buildSingleDateTable } from './singleDateTable.js';
import { buildDateRangeTable } from './rangeDateTable.js';
import { showPriceFilterPopup } from './priceFilter.js';
import { showDateFilterPopup } from './dateFilters.js';
import { pathDrawing } from '../pathDrawing.js';
import { flightMap } from '../flightMap.js';

function buildRouteTable(routeIndex) {
  const dateRange = appState.routeDates[routeIndex + 1];
  if (dateRange && dateRange.includes(' to ')) {
    buildDateRangeTable(routeIndex, dateRange);
  } else {
    buildSingleDateTable(routeIndex, dateRange);
  }
}

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

      let newRouteGroupId = null;
      const routeDetails = appState.selectedRoutes[routeIndex];
      if (routeDetails) {
        newRouteGroupId = routeDetails.group;
      }

      if (newRouteGroupId !== null) {
        Object.keys(appState.selectedRoutes).forEach(key => {
          if (appState.selectedRoutes[key].group === newRouteGroupId) {
            updateState('removeSelectedRoute', parseInt(key));
          }
        });
      }

      routeIds.forEach((id, idx) => {
        const currentRouteIndex = routeIndex + idx;
        const displayData = {
          departure: new Date(fullFlightData.dTime).toLocaleString(),
          arrival: new Date(fullFlightData.aTime).toLocaleString(),
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
  document.querySelectorAll(`.route-info-table[data-route-index="${routeIndex}"] tbody tr.selected`).forEach(row => {
    row.classList.remove('selected');
  });

  const selectedRouteDetails = appState.selectedRoutes[routeIndex];
  if (selectedRouteDetails && selectedRouteDetails.id) {
    let selectedRow = document.querySelector('.route-info-table tbody tr');
    if (!selectedRow) {
      document.querySelectorAll(`.route-info-table[data-route-index="${routeIndex}"] tbody tr`).forEach(row => {
        const routeId = row.getAttribute('data-route-id');
        if (routeId && routeId.split('|').includes(selectedRouteDetails.id)) {
          selectedRow = row;
        }
      });
    }

    if (selectedRow) {
      selectedRow.classList.add('selected');
    }
  }
}

function replaceWaypointsForCurrentRoute(intermediaryIatas, routeIndex) {
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

  if (appState.roundTrip) {
      const originIata = intermediaryIatas[0];
      if (updatedSegment[updatedSegment.length - 1].iata_code !== originIata) {
          updatedSegment.push(flightMap.airportDataCache[originIata]);
      }
  } else {
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

  table.querySelectorAll("th").forEach(th => th.classList.remove("th-sort-asc", "th-sort-desc"));
  if (asc) {
    table.querySelector(`th:nth-child(${columnIndex})`).classList.add("th-sort-asc");
  } else {
    table.querySelector(`th:nth-child(${columnIndex})`).classList.add("th-sort-desc");
  }
}

export { buildRouteTable, getColumnIndex, attachEventListeners, highlightSelectedRowForRouteIndex, replaceWaypointsForCurrentRoute, resetSortIcons, sortTableByColumn };

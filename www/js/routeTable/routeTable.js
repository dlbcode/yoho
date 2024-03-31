import { appState } from '../stateManager.js';
import { buildSingleDateTable } from './singleDateTable.js';
import { buildDateRangeTable } from './rangeDateTable.js';
import { buildAnyDestTable } from './anyDestTable.js'; // Import the buildAnyOriginTable function


function buildRouteTable(routeIndex) {
  const dateRange = appState.routeDates[routeIndex];

  let origin, destination;

  if (appState.routes[routeIndex] && appState.routes[routeIndex].originAirport && appState.routes[routeIndex].destinationAirport) {
      origin = appState.routes[routeIndex].originAirport.iata_code;
      destination = appState.routes[routeIndex].destinationAirport.iata_code;
  } else {
      origin = appState.waypoints[routeIndex * 2]?.iata_code;
      destination = appState.waypoints[(routeIndex * 2) + 1]?.iata_code || 'Any';
  }

  if (destination === 'Any') {
    // if origin is 'Any', it means the user wants to search for flights from any origin
    buildAnyDestTable(routeIndex, origin, dateRange);
    return;
  } else if (dateRange && dateRange.includes(' to ')) {
    // If dateRange includes ' to ', it indicates a range of dates
    buildDateRangeTable(routeIndex, dateRange);
  } else {
    // Otherwise, it's a single departure date
    buildSingleDateTable(routeIndex);
  }
}

export { buildRouteTable };
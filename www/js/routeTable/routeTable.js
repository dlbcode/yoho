import { appState } from '../stateManager.js';
import { buildSingleDateTable } from './singleDateTable.js';
import { buildDateRangeTable } from './rangeDateTable.js';
import { buildAnyDestTable } from './anyDestTable.js'; // Import the buildAnyOriginTable function


function buildRouteTable(routeIndex) {
  const dateRange = appState.routeDates[routeIndex];
  console.log('buildRouteTable Route Index: ', routeIndex);
  console.log('buildRouteTable Route: ', appState.routes[routeIndex]);

  let origin, destination;

if (appState.routes[routeIndex] && appState.routes[routeIndex].originAirport && appState.routes[routeIndex].destinationAirport) {
    origin = appState.routes[routeIndex].originAirport.iata_code;
    destination = appState.routes[routeIndex].destinationAirport.iata_code;
} else {
    // Adjusting this to ensure origin is set correctly when routeIndex is out of bounds
    // or when the route does not have the expected airports
    origin = appState.waypoints[routeIndex * 2]?.iata_code;
    destination = appState.waypoints[(routeIndex * 2) + 1]?.iata_code || 'Any';
}

  console.log('buildRouteTable anyDest from: ', origin);

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
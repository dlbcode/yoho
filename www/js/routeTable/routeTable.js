import { appState } from '../stateManager.js';
import { buildSingleDateTable } from './singleDateTable.js';
import { buildDateRangeTable } from './rangeDateTable.js';
import { buildAnyDestTable } from './anyDestTable.js'; // Import the buildAnyOriginTable function


function buildRouteTable(routeIndex) {
  const dateRange = appState.routeDates[routeIndex]; // Use routeIndex directly to access the date or date range
  console.log('buildRouteTable Route Index: ', routeIndex);
  console.log('buildRouteTable Route: ', appState.routes[routeIndex]);
  
  let origin;
  let destination;

  if (appState.routes.length === 0) {
    origin = appState.waypoints[0]?.iata_code || 'Any';
    destination = appState.waypoints[1]?.iata_code || 'Any';
  } else {
    origin = appState.routes[routeIndex].originAirport.iata_code;
    destination = appState.routes[routeIndex].destinationAirport.iata_code;
  }  

  console.log('buildRouteTable anyDest from: ', origin);

  if (destination === 'Any') {
    // if origin is 'Any', it means the user wants to search for flights from any origin
    buildAnyDestTable(routeIndex, origin);
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
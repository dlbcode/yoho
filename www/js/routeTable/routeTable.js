import { appState } from '../stateManager.js';
import { buildSingleDateTable } from './singleDateTable.js';
import { buildDateRangeTable } from './rangeDateTable.js';

function buildRouteTable(routeIndex) {
  const dateRange = appState.routeDates[routeIndex]; // Use routeIndex directly to access the date or date range

  //if (!dateRange) {
  //  console.error('Departure date is undefined for routeIndex:', routeIndex);
  //  return; // Exit the function if no date is found to prevent further errors
  //}

  if (dateRange && dateRange.includes(' to ')) {
    // If dateRange includes ' to ', it indicates a range of dates
    buildDateRangeTable(routeIndex, dateRange);
  } else {
    // Otherwise, it's a single departure date
    buildSingleDateTable(routeIndex);
  }
}

export { buildRouteTable };
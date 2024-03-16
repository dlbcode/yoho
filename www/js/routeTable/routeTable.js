import { appState } from '../stateManager.js';
import { buildSingleDateTable } from './singleDateTable.js';
import { buildDateRangeTable } from './rangeDateTable.js';

function buildRouteTable(routeIndex) {
  // Directly use routeIndex to access the departure date
  const dateRange = appState.routeDates[routeIndex];
  if (dateRange && dateRange.includes(' to ')) {
    buildDateRangeTable(routeIndex, dateRange);
  } else {
    buildSingleDateTable(routeIndex); // Pass only routeIndex
  }
}


export { buildRouteTable };
import { flightMap } from './flightMap.js';
import { flightList } from './flightList.js';
import './eventListeners.js';

// Initialize map-related functionalities
function initMapFunctions() {
    flightMap.plotFlightPaths();
    flightList.initTravelerControls();
}

document.addEventListener('DOMContentLoaded', initMapFunctions);

import { flightMap } from './flightMap.js';
import { flightList } from './flightList.js';
import './eventListeners.js';

// Initialize map-related functionalities
function initMapFunctions() {
    flightMap.plotFlightPaths();
    flightList.initTravelerControls();
}

// Initial resize on load
document.getElementById('map').style.height = window.innerHeight + 'px';
document.addEventListener('DOMContentLoaded', initMapFunctions);

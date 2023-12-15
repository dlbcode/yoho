import { map } from './mapInit.js';
import './iconsAndMarkers.js'; // Only needed if these exports are used elsewhere
import { FlightMap } from './flightMap.js';
import './eventListeners.js';

// Initialize any functionality that needs to be started on load
FlightMap.plotFlightPaths();
FlightMap.initTravelerControls();

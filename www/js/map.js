import { flightMap } from './flightMap.js';
import { flightList } from './flightList.js';
import './eventListeners.js';

// Initialize any functionality that needs to be started on load
flightMap.plotFlightPaths();
flightList.initTravelerControls();

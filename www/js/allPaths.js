import { map } from './map.js'; // Import the map object directly from mapInit.js
import { flightMap } from './flightMap.js';

let allPathsDrawn = false;
let flightDataCache = null; // Global cache for flight data

// Function to draw all flight paths
function drawAllFlightPaths() {
  if (allPathsDrawn) {
    flightMap.clearFlightPaths();
    allPathsDrawn = false;
  } else {
    // Check if data is already cached
    if (flightDataCache) {
      flightDataCache.forEach(flight => drawFlightPath(flight));
      console.info('Flight data loaded from cache');
      allPathsDrawn = true;
    } else {
      fetch('http://localhost:3000/flights')
        .then(response => response.json())
        .then(flights => {
            flightDataCache = flights; // Cache the fetched data
            flights.forEach(flight => {
                if (!flight.originAirport || !flight.destinationAirport) {
                    console.info('Incomplete flight data:', flight);
                    return;
                }
                // Draw paths without text decorations
                drawFlightPath(flight);
                allPathsDrawn = true;
            });
            console.info('Flight data loaded from API');
        })
        .catch(error => console.error('Error fetching flights:', error));
    }
  }
}

// Function to draw a single flight path
function drawFlightPath(flight) {
  // Adjust origin and destination for geodesic lines
  const adjustedOrigin = [flight.originAirport.latitude, flight.originAirport.longitude];
  const adjustedDestination = [flight.destinationAirport.latitude, flight.destinationAirport.longitude];

  const geodesicLine = new L.Geodesic([adjustedOrigin, adjustedDestination], {
      weight: 1,
      opacity: 0.7,
      color: flightMap.getColorBasedOnPrice(flight.price), // Color based on price
      wrap: false
  }).addTo(map);

  // Optionally add event listeners and additional functionality as needed

  // Store the geodesic line
  flightMap.currentLines.push(geodesicLine);

  // Return the geodesic line if you need to reference it later
  return geodesicLine;
}

// Export the drawAllFlightPaths function for use in other modules
export { drawAllFlightPaths };

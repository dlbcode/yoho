import { map } from './map.js';
import { flightMap } from './flightMap.js';
import { pathDrawing } from './pathDrawing.js'; // Import pathDrawing

let allPathsDrawn = false;
let flightDataCache = null; // Global cache for flight data

// Function to draw all flight paths
function drawAllFlightPaths() {
  if (allPathsDrawn) {
    pathDrawing.clearFlightPaths(); // Use pathDrawing's clearFlightPaths
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
                drawFlightPath(flight); // Draw paths
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
  let flightId = `${flight.originAirport.iata_code}-${flight.destinationAirport.iata_code}`;
  if (pathDrawing.currentLines.some(line => line.flightId === flightId)) {
      return; // Path already exists, no need to create a new one
  }

  const adjustedOrigin = [flight.originAirport.latitude, flight.originAirport.longitude];
  const adjustedDestination = [flight.destinationAirport.latitude, flight.destinationAirport.longitude];

  const geodesicLine = new L.Geodesic([adjustedOrigin, adjustedDestination], {
      weight: 1,
      opacity: 0.7,
      color: flightMap.getColorBasedOnPrice(flight.price),
      wrap: false
  }).addTo(map);

  geodesicLine.flightId = flightId; // Assign a unique identifier to the line
  pathDrawing.currentLines.push(geodesicLine);
}

// Export the drawAllFlightPaths function for use in other modules
export { drawAllFlightPaths };

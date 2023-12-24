import { map } from './map.js';
import { flightMap } from './flightMap.js';
import { pathDrawing } from './pathDrawing.js';

let allPathsDrawn = false;
let flightDataCache = null;

// Function to draw all flight paths
function drawAllFlightPaths() {
  if (allPathsDrawn) {
    pathDrawing.clearFlightPaths();
    allPathsDrawn = false;
  } else {
    // Check if data is already cached
    if (flightDataCache) {
      flightDataCache.forEach(flight => drawFlightPath(flight));
      console.info('Flight data loaded from cache');
      allPathsDrawn = true;
    } else {
      fetch('http://yonderhop.com:3000/flights')
        .then(response => response.json())
        .then(flights => {
            flightDataCache = flights;
            flights.forEach(flight => {
                if (!flight.originAirport || !flight.destinationAirport) {
                    console.info('Incomplete flight data:', flight);
                    return;
                }
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
  let flightId = `${flight.originAirport.iata_code}-${flight.destinationAirport.iata_code}`;
  if (pathDrawing.currentLines.some(line => line.flightId === flightId)) {
      return;
  }

  const adjustedOrigin = [flight.originAirport.latitude, flight.originAirport.longitude];
  const adjustedDestination = [flight.destinationAirport.latitude, flight.destinationAirport.longitude];

  const geodesicLine = new L.Geodesic([adjustedOrigin, adjustedDestination], {
      weight: 1,
      opacity: 0.7,
      color: flightMap.getColorBasedOnPrice(flight.price),
      wrap: false
  }).addTo(map);

  geodesicLine.flightId = flightId;
  pathDrawing.currentLines.push(geodesicLine);
}

export { drawAllFlightPaths };

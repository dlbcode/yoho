import { map } from './mapInit.js'; // Import the map object directly from mapInit.js
import { flightMap } from './flightMap.js';

// Function to draw all flight paths
function drawAllFlightPaths() {
    fetch('http://localhost:3000/flights')
        .then(response => response.json())
        .then(flights => {
            flights.forEach(flight => {
                if (!flight.originAirport || !flight.destinationAirport) {
                    console.info('Incomplete flight data:', flight);
                    return;
                }

                // Draw paths without text decorations
                drawFlightPath(flight);
            });
        })
        .catch(error => console.error('Error fetching flights:', error));
}

// Function to draw a single flight path
function drawFlightPath(flight) {
  const origin = [flight.originAirport.latitude, flight.originAirport.longitude];
  const destination = [flight.destinationAirport.latitude, flight.destinationAirport.longitude];

  const pathOptions = {
      color: flightMap.getColorBasedOnPrice(flight.price),
      weight: calculatePathWeight(flight),
      opacity: 0.7
  };

  // Use the directly imported map object
  const flightPath = L.polyline([origin, destination], pathOptions).addTo(map);

    // Store the flight path
    flightMap.currentLines.push(flightPath);
}

// Function to calculate path weight (customize as needed)
function calculatePathWeight(flight) {
    // Example: Weight calculation based on a specific metric (can be customized)
    return 5; // Fixed weight for simplicity, modify as per your requirements
}

// Export the drawAllFlightPaths function for use in other modules
export { drawAllFlightPaths };

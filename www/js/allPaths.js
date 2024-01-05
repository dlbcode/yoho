import { map } from './map.js';
import { flightMap } from './flightMap.js';
import { pathDrawing } from './pathDrawing.js';
import { appState, updateState } from './stateManager.js';

let allPathsDrawn = false;
let routeDataCache = null;

// Function to draw all route paths
function drawAllRoutePaths() {
  if (allPathsDrawn) {
    pathDrawing.clearRoutePaths();
    allPathsDrawn = false;
  } else {
    // Check if data is already cached
    if (routeDataCache) {
      routeDataCache.forEach(route => drawRoutePath(route));
      console.info('Route data loaded from cache');
      allPathsDrawn = true;
    } else {
      fetch('http://yonderhop.com:3000/routes')
        .then(response => response.json())
        .then(routes => {
            routeDataCache = routes;
            routes.forEach(route => {
                if (!route.originAirport || !route.destinationAirport) {
                    console.info('Incomplete route data:', route);
                    return;
                }
                drawRoutePath(route);
                allPathsDrawn = true;
            });
            console.info('Route data loaded from API');
        })
        .catch(error => console.error('Error fetching routes:', error));
    }
  }
}

// Function to draw a single route path
function drawRoutePath(route) {
  let routeId = `${route.originAirport.iata_code}-${route.destinationAirport.iata_code}`;
  if (pathDrawing.currentLines.some(line => line.routeId === routeId)) {
      return;
  }

  const adjustedOrigin = [route.originAirport.latitude, route.originAirport.longitude];
  const adjustedDestination = [route.destinationAirport.latitude, route.destinationAirport.longitude];

  const geodesicLine = new L.Geodesic([adjustedOrigin, adjustedDestination], {
      weight: 1,
      opacity: 0.7,
      color: flightMap.getColorBasedOnPrice(route.price),
      wrap: false
  }).addTo(map);

  geodesicLine.routeId = routeId;
  pathDrawing.currentLines.push(geodesicLine);
}

export { drawAllRoutePaths };

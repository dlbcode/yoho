import { map } from './map.js';
import { flightMap } from './flightMap.js';
import { pathDrawing } from './pathDrawing.js';

let allPathsDrawn = false;
let routeDataCache = null;

// Function to draw all route paths
function drawAllRoutePaths() {
    if (allPathsDrawn) {
        pathDrawing.clearLines();
        allPathsDrawn = false;
    } else {
        // Check if data is already cached
        if (routeDataCache) {
            drawRoutesFromCache();
            console.info('Route data loaded from cache');
        } else {
            fetchRoutesFromAPI();
        }
    }
}

function drawRoutesFromCache() {
  drawRoutesAsync(routeDataCache);
}

function fetchRoutesFromAPI() {
  fetch('http://yonderhop.com:3000/directRoutes?to')
      .then(response => response.json())
      .then(routes => {
          routeDataCache = routes;
          drawRoutesAsync(routes);
      })
      .catch(error => console.error('Error fetching routes:', error));
}

function drawRoutesAsync(routes) {
  routes.forEach((route, index) => {
      setTimeout(() => {
          if (isValidRoute(route)) {
              drawRoutePath(route);
          }
          if (index === routes.length - 1) {
              allPathsDrawn = true;
              console.info('All routes drawn');
          }
      }, 0);
  });
}

// Function to check if a route is valid
function isValidRoute(route) {
    return route.originAirport && route.destinationAirport;
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

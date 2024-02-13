import { map } from './map.js';
import { flightMap } from './flightMap.js';
import { pathDrawing } from './pathDrawing.js';

let routeDataCache = null;

// Function to draw all route paths
function drawAllRoutePaths() {
    pathDrawing.clearLines();
    // Check if data is already cached
    if (routeDataCache) {
        drawRoutesFromCache();
        console.info('Route data loaded from cache');
    } else {
        fetchRoutesFromAPI();
    }
}

function drawRoutesFromCache() {
  drawRoutesAsync(routeDataCache);
}

async function fetchRoutesFromAPI() {
    try {
        const response = await fetch('https://yonderhop.com/api/aggregateRoutes');
        const routes = await response.json(); // This is now an array of route objects
        routeDataCache = routes; // Cache the fetched data for future use
        drawRoutesAsync(routes); // Directly pass the array of routes
    } catch (error) {
        console.error('Error fetching aggregated routes:', error);
    }
}

function drawRoutesAsync(routes) {
    routes.forEach(route => {
        if (isValidRoute(route)) {
            drawRoutePath(route);
        }
    });
    console.info('All routes drawn');
}

// Adjust the isValidRoute function if necessary
function isValidRoute(route) {
    // Check for the existence of necessary properties in both origin and destination
    return route.origin && route.destination && 
           typeof route.origin.latitude === 'number' && typeof route.origin.longitude === 'number' &&
           typeof route.destination.latitude === 'number' && typeof route.destination.longitude === 'number';
}

// Function to draw a single route path
function drawRoutePath(route) {
    // Use origin_iata_code and destination_iata_code to construct routeId
    const routeId = `${route.origin_iata_code}-${route.destination_iata_code}`;

    const origin = [route.origin.latitude, route.origin.longitude];
    const destination = [route.destination.latitude, route.destination.longitude];

    const geodesicLine = new L.Geodesic([origin, destination], {
        weight: 1,
        opacity: 0.7,
        color: flightMap.getColorBasedOnPrice(route.price),
        wrap: false
    }).addTo(map);

    // Assign routeId to the geodesicLine for potential future reference
    geodesicLine.routeId = routeId;
    pathDrawing.currentLines.push(geodesicLine);
}

export { drawAllRoutePaths };

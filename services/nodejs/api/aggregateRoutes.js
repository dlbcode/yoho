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

async function fetchRoutesFromAPI() {
    try {
        const response = await fetch('https://yonderhop.com/api/aggregateRoutes');
        const routes = await response.json();
        routeDataCache = routes; // Cache the fetched data for future use
        drawRoutesAsync(routes);
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
    allPathsDrawn = true;
}

// Function to check if a route is valid
function isValidRoute(route) {
    return route.origin && route.destination;
}

// Function to draw a single route path
function drawRoutePath(route) {
    const origin = [route.origin.latitude, route.origin.longitude];
    const destination = [route.destination.latitude, route.destination.longitude];

    const geodesicLine = new L.Geodesic([origin, destination], {
        weight: 1,
        opacity: 0.7,
        color: flightMap.getColorBasedOnPrice(route.price),
        wrap: false
    }).addTo(map);

    // Optionally, you might want to store the geodesicLine or route information for further use
}

export { drawAllRoutePaths };

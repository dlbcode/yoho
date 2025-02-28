import { appState, updateState } from './stateManager.js';
import { flightMap } from './flightMap.js';
import { pathDrawing } from './pathDrawing.js';
import { lineManager } from './lineManager.js';

const routeHandling = {
    updateRoutesArray: async function() {
        // Clear all existing route lines before drawing new ones
        lineManager.clearLines('route');
        
        let newRoutes = [];
        const waypoints = appState.routeDirection === 'to' ? 
            [...appState.waypoints].reverse() : 
            appState.waypoints;

        // Batch fetch routes
        const uniqueIataCodes = [...new Set(waypoints.map(wp => wp.iata_code))];
        await Promise.all(
            uniqueIataCodes
                .filter(code => !appState.directRoutes[code])
                .map(code => flightMap.fetchAndCacheRoutes(code))
        );

        // Build routes array
        for (let i = 0; i < waypoints.length; i += 2) {
            const fromWaypoint = waypoints[i];
            const toWaypoint = waypoints[i + 1];
            
            const routeIndex = i / 2;
            const isSelected = !!appState.selectedRoutes[routeIndex];
            
            if (!fromWaypoint) continue;

            if (!toWaypoint) {
                newRoutes.push({
                    origin: fromWaypoint.iata_code,
                    destination: 'Any',
                    isDirect: false,
                    price: null,
                    tripType: appState.routes[i/2]?.tripType || 'oneWay'
                });
                continue;
            }

            // Get the selected route price if available
            let routePrice = null;
            if (isSelected) {
                // Use the selected route's price from the state
                const selectedRoute = appState.selectedRoutes[routeIndex];
                if (selectedRoute && selectedRoute.displayData) {
                    routePrice = selectedRoute.displayData.price;
                }
            }

            const route = flightMap.findRoute(fromWaypoint.iata_code, toWaypoint.iata_code);
            if (route) {
                newRoutes.push({
                    ...route,
                    isDirect: true,
                    isSelected: isSelected,
                    // Use the selected route price if available, otherwise use the direct route price
                    price: routePrice !== null ? routePrice : route.price,
                    tripType: appState.routes[i/2]?.tripType || 'oneWay'
                });
            } else {
                newRoutes.push({
                    origin: fromWaypoint.iata_code,
                    destination: toWaypoint.iata_code,
                    isDirect: false,
                    isSelected: isSelected,
                    // Use the selected route price if available
                    price: routePrice,
                    tripType: appState.routes[i/2]?.tripType || 'oneWay'
                });
            }
        }

        // Update state and redraw
        updateState('updateRoutes', newRoutes, 'routeHandling.updateRoutesArray');
        console.log('Updated routes:', appState.routes);
        await pathDrawing.drawLines();
    }
};

export { routeHandling };

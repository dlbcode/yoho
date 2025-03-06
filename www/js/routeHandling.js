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

        // Batch fetch routes for non-Any waypoints
        const uniqueIataCodes = [...new Set(
            waypoints
                .filter(wp => wp && wp.iata_code && wp.iata_code !== 'Any')
                .map(wp => wp.iata_code)
        )];
        
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

            // Special handling for Any origin or Any destination
            if (fromWaypoint.iata_code === 'Any' || toWaypoint.iata_code === 'Any') {
                const routeData = {
                    origin: fromWaypoint.iata_code,
                    destination: toWaypoint.iata_code,
                    isDirect: false,
                    isSelected: isSelected,
                    price: isSelected ? appState.selectedRoutes[routeIndex]?.displayData?.price || null : null,
                    tripType: appState.routes[i/2]?.tripType || 'oneWay'
                };
                
                // If this is an "Any" origin route, add flag
                if (fromWaypoint.iata_code === 'Any') {
                    routeData.hasAnyOrigin = true;
                }
                
                // If this is an "Any" destination route, add flag
                if (toWaypoint.iata_code === 'Any') {
                    routeData.hasAnyDestination = true;
                }
                
                newRoutes.push(routeData);
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

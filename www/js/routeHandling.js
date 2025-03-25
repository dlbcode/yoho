import { appState, updateState } from './stateManager.js';
import { flightMap } from './flightMap.js';
import { pathDrawing } from './pathDrawing.js';
import { lineManager } from './lineManager.js';

const routeHandling = {
    updateRoutesArray: async function() {
        // Clear all existing route lines before drawing new ones
        lineManager.clearLines('route');
        
        let newRoutes = [];
        
        // First check if we should use the new route data structure
        if (appState.routeData && appState.routeData.length > 0) {
            // Don't reverse waypoints if origin is "Any" - add a check here
            const hasAnyOrigin = appState.routeData.some(r => r && r.origin && r.origin.iata_code === 'Any');
            
            // Process each route in routeData
            for (let i = 0; i < appState.routeData.length; i++) {
                const route = appState.routeData[i];
                if (!route || route.isEmpty) continue;
                
                // Apply route direction logic if needed
                let origin = route.origin;
                let destination = route.destination;
                
                // If routeDirection is 'to' and we don't have "Any" origins, swap origin and destination
                if (appState.routeDirection === 'to' && !hasAnyOrigin) {
                    [origin, destination] = [destination, origin];
                }
                
                // Skip if no origin or destination
                if (!origin && !destination) continue;
                
                const routeIndex = i;
                const isSelected = !!appState.selectedRoutes[routeIndex];
                
                // Special handling for Any origin or Any destination
                if ((origin && origin.iata_code === 'Any') || (destination && destination.iata_code === 'Any')) {
                    const routeData = {
                        origin: origin?.iata_code || 'Any',
                        destination: destination?.iata_code || 'Any',
                        isDirect: false,
                        isSelected: isSelected,
                        price: isSelected ? appState.selectedRoutes[routeIndex]?.displayData?.price || null : null,
                        tripType: route.tripType || 'oneWay',
                        travelers: route.travelers || 1
                    };
                    
                    // If this is an "Any" origin route, add flag
                    if (origin && origin.iata_code === 'Any') {
                        routeData.hasAnyOrigin = true;
                    }
                    
                    // If this is an "Any" destination route, add flag
                    if (destination && destination.iata_code === 'Any') {
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

                // Only look up route if both origin and destination have valid IATA codes
                if (origin?.iata_code && destination?.iata_code) {
                    const foundRoute = flightMap.findRoute(origin.iata_code, destination.iata_code);
                    if (foundRoute) {
                        newRoutes.push({
                            ...foundRoute,
                            isDirect: true,
                            isSelected: isSelected,
                            // Use the selected route price if available, otherwise use the direct route price
                            price: routePrice !== null ? routePrice : foundRoute.price,
                            tripType: route.tripType || 'oneWay',
                            travelers: route.travelers || 1
                        });
                    } else {
                        newRoutes.push({
                            origin: origin.iata_code,
                            destination: destination.iata_code,
                            isDirect: false,
                            isSelected: isSelected,
                            // Use the selected route price if available
                            price: routePrice,
                            tripType: route.tripType || 'oneWay',
                            travelers: route.travelers || 1
                        });
                    }
                } else {
                    // Handle case where one of them is missing
                    newRoutes.push({
                        origin: origin?.iata_code || 'Any',
                        destination: destination?.iata_code || 'Any',
                        isDirect: false,
                        isSelected: isSelected,
                        price: routePrice,
                        tripType: route.tripType || 'oneWay',
                        travelers: route.travelers || 1
                    });
                }
            }
        } else {
            // Fall back to legacy logic using waypoints array
            // Don't reverse waypoints if origin is "Any" - add a check here
            const hasAnyOrigin = appState.waypoints.some((wp, i) => 
                i % 2 === 0 && wp && (wp.iata_code === 'Any' || wp.isAnyOrigin));
            
            // Only apply routeDirection logic if we don't have an "Any" origin
            const waypoints = (appState.routeDirection === 'to' && !hasAnyOrigin) ? 
                [...appState.waypoints].reverse() : 
                appState.waypoints;

            // Ensure waypoint pairs are properly ordered
            // If we have an odd number of waypoints and last one isn't "Any", add "Any" as destination
            if (waypoints.length % 2 !== 0 && waypoints[waypoints.length - 1] && 
                waypoints[waypoints.length - 1].iata_code !== 'Any') {
                waypoints.push({
                    iata_code: 'Any',
                    city: 'Anywhere',
                    isAnyDestination: true
                });
            }

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
        }

        // Update state and redraw
        updateState('updateRoutes', newRoutes, 'routeHandling.updateRoutesArray');
        console.log('Updated routes:', appState.routes);
        await pathDrawing.drawLines();
    }
};

export { routeHandling };

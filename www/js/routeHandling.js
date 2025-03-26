import { appState, updateState } from './stateManager.js';
import { flightMap } from './flightMap.js';
import { pathDrawing } from './pathDrawing.js';
import { lineManager } from './lineManager.js';

const routeHandling = {
    updateRoutesArray: async function() {
        console.log("updateRoutesArray called, routeData:", appState.routeData);
        
        // Clear all existing route lines before drawing new ones
        lineManager.clearLines('route');
        
        let newRoutes = [];
        
        // First check if we should use the new route data structure
        if (appState.routeData && appState.routeData.length > 0) {
            console.log("Processing routeData for routes:", appState.routeData);
            
            // Don't reverse waypoints if origin is "Any" - add a check here
            const hasAnyOrigin = appState.routeData.some(r => r && r.origin && r.origin.iata_code === 'Any');
            
            // Process each route in routeData
            for (let i = 0; i < appState.routeData.length; i++) {
                const route = appState.routeData[i];
                if (!route || route.isEmpty) {
                    console.log(`Skipping empty route at index ${i}`);
                    continue;
                }
                
                // Important: log what we're working with to diagnose issues
                console.log(`Processing route ${i}:`, route);
                
                // Apply route direction logic if needed
                let origin = route.origin;
                let destination = route.destination;
                
                // If routeDirection is 'to' and we don't have "Any" origins, swap origin and destination
                if (appState.routeDirection === 'to' && !hasAnyOrigin) {
                    [origin, destination] = [destination, origin];
                    
                    // Also update the routeData to reflect this swap
                    appState.routeData[i] = {
                        ...route,
                        origin: destination,
                        destination: origin
                    };
                }
                
                // Skip if no origin or destination
                if (!origin && !destination) {
                    console.log(`Skipping route ${i} - missing both origin and destination`);
                    continue;
                }
                
                console.log(`Route ${i} origin:`, origin);
                console.log(`Route ${i} destination:`, destination);
                
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
                    
                    console.log(`Adding "Any" route ${i}:`, routeData);
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
                    console.log(`Looking up route from ${origin.iata_code} to ${destination.iata_code}`);
                    const foundRoute = flightMap.findRoute(origin.iata_code, destination.iata_code);
                    if (foundRoute) {
                        const newRoute = {
                            ...foundRoute,
                            isDirect: true,
                            isSelected: isSelected,
                            // Use the selected route price if available, otherwise use the direct route price
                            price: routePrice !== null ? routePrice : foundRoute.price,
                            tripType: route.tripType || 'oneWay',
                            travelers: route.travelers || 1
                        };
                        console.log(`Adding direct route ${i}:`, newRoute);
                        newRoutes.push(newRoute);
                    } else {
                        const newRoute = {
                            origin: origin.iata_code,
                            destination: destination.iata_code,
                            isDirect: false,
                            isSelected: isSelected,
                            // Use the selected route price if available
                            price: routePrice,
                            tripType: route.tripType || 'oneWay',
                            travelers: route.travelers || 1
                        };
                        console.log(`Adding indirect route ${i}:`, newRoute);
                        newRoutes.push(newRoute);
                    }
                } else {
                    // Handle case where one of them is missing
                    const newRoute = {
                        origin: origin?.iata_code || 'Any',
                        destination: destination?.iata_code || 'Any',
                        isDirect: false,
                        isSelected: isSelected,
                        price: routePrice,
                        tripType: route.tripType || 'oneWay',
                        travelers: route.travelers || 1
                    };
                    console.log(`Adding partial route ${i}:`, newRoute);
                    newRoutes.push(newRoute);
                }
            }
        } else {
            // Fall back to legacy logic using waypoints array
            console.log("Using legacy waypoints array for routes:", appState.waypoints);
            
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
        console.log("Final routes array:", newRoutes);
        updateState('updateRoutes', newRoutes, 'routeHandling.updateRoutesArray');
        console.log('Updated routes in state:', appState.routes);
        await pathDrawing.drawLines();
    },
    
    // Add a new method to ensure we have consistent data between routeData and waypoints
    syncRouteDataWithWaypoints: function() {
        // This ensures routeData is in sync with waypoints (which are used by some legacy code)
        
        // First convert waypoints to routeData format
        for (let i = 0; i < appState.waypoints.length; i += 2) {
            const routeIndex = Math.floor(i / 2);
            const origin = appState.waypoints[i];
            const destination = appState.waypoints[i + 1];
            
            if (origin || destination) {
                // Initialize routeData entry if needed
                if (!appState.routeData[routeIndex]) {
                    appState.routeData[routeIndex] = {
                        tripType: appState.routes[routeIndex]?.tripType || 'oneWay',
                        travelers: appState.routes[routeIndex]?.travelers || 1,
                        departDate: appState.routeDates[routeIndex]?.depart || null,
                        returnDate: appState.routeDates[routeIndex]?.return || null,
                        origin: origin,
                        destination: destination
                    };
                } else {
                    // Update existing entry
                    appState.routeData[routeIndex].origin = origin;
                    appState.routeData[routeIndex].destination = destination;
                }
            }
        }
        
        // Then convert routeData back to waypoints
        for (let i = 0; i < appState.routeData.length; i++) {
            const routeData = appState.routeData[i];
            if (routeData && !routeData.isEmpty) {
                const originIndex = i * 2;
                const destIndex = i * 2 + 1;
                
                // Make sure waypoints array is big enough
                while (appState.waypoints.length <= destIndex) {
                    appState.waypoints.push(null);
                }
                
                appState.waypoints[originIndex] = routeData.origin;
                appState.waypoints[destIndex] = routeData.destination;
            }
        }
    }
};

export { routeHandling };

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
        
        // Process each route in routeData
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
                    
                    // Preserve the full origin and destination objects
                    if (origin) {
                        routeData.originData = origin;
                    }
                    
                    if (destination) {
                        routeData.destinationData = destination;
                    }
                    
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
        }

        // Update state and redraw
        console.log("Final routes array:", newRoutes);
        updateState('updateRoutes', newRoutes, 'routeHandling.updateRoutesArray');
        console.log('Updated routes in state:', appState.routes);
        await pathDrawing.drawLines();
    },
    
    // Updated method to ensure we have consistent data between routeData and waypoints
    syncRouteDataWithWaypoints: function() {
        // This ensures routeData is in sync with waypoints (which are used by some legacy code)
        // We're keeping this solely for backward compatibility with other modules
        // In the future, we should remove this method and ensure all code uses routeData directly
        
        // Only convert routeData back to waypoints for backward compatibility
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

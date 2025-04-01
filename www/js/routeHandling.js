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
        
        // Process each route in routeData - exclusively use routeData
        if (appState.routeData && appState.routeData.length > 0) {
            console.log("Processing routeData for routes:", appState.routeData);
            
            // Check for "Any" origins directly in routeData
            const hasAnyOrigin = appState.routeData.some(r => r && r.origin && r.origin.iata_code === 'Any');
            
            // Process each route in routeData
            for (let i = 0; i < appState.routeData.length; i++) {
                const route = appState.routeData[i];
                
                // Skip empty routes
                if (!route || route.isEmpty) {
                    console.log(`Skipping empty route at index ${i}`);
                    continue;
                }
                
                console.log(`Processing route ${i}:`, route);
                
                // Apply route direction logic if needed
                let origin = route.origin;
                let destination = route.destination;
                
                // If routeDirection is 'to' and we don't have "Any" origins, swap origin and destination
                if (appState.routeDirection === 'to' && !hasAnyOrigin) {
                    [origin, destination] = [destination, origin];
                    
                    // Update the routeData to reflect this swap
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
                // Check if this route has a selected route in routeData's own structure
                const isSelected = !!appState.routeData[routeIndex]?.selectedRoute || !!appState.selectedRoutes[routeIndex];
                
                // Special handling for Any origin or Any destination
                if ((origin && origin.iata_code === 'Any') || (destination && destination.iata_code === 'Any')) {
                    const routeData = {
                        origin: origin?.iata_code || 'Any',
                        destination: destination?.iata_code || 'Any',
                        isDirect: false,
                        isSelected: isSelected,
                        price: null,
                        tripType: route.tripType || 'oneWay',
                        travelers: route.travelers || 1
                    };
                    
                    // Get price from routeData's selectedRoute if available
                    if (isSelected) {
                        if (appState.routeData[routeIndex]?.selectedRoute?.displayData?.price) {
                            routeData.price = appState.routeData[routeIndex].selectedRoute.displayData.price;
                        } else if (appState.selectedRoutes[routeIndex]?.displayData?.price) {
                            routeData.price = appState.selectedRoutes[routeIndex].displayData.price;
                        }
                    }
                    
                    // Preserve the full origin and destination objects
                    if (origin) {
                        routeData.originData = origin;
                    }
                    
                    if (destination) {
                        routeData.destinationData = destination;
                    }
                    
                    // Flag for "Any" waypoints
                    if (origin && origin.iata_code === 'Any') {
                        routeData.hasAnyOrigin = true;
                    }
                    
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
                    // Use the selected route's price from routeData first, then fall back to selectedRoutes
                    if (appState.routeData[routeIndex]?.selectedRoute?.displayData?.price) {
                        routePrice = appState.routeData[routeIndex].selectedRoute.displayData.price;
                    } else if (appState.selectedRoutes[routeIndex]?.displayData?.price) {
                        routePrice = appState.selectedRoutes[routeIndex].displayData.price;
                    }
                }

                // Look up route if both origin and destination have valid IATA codes
                if (origin?.iata_code && destination?.iata_code) {
                    console.log(`Looking up route from ${origin.iata_code} to ${destination.iata_code}`);
                    
                    // Bug fix: First ensure we have directRoutes loaded for the origin
                    let isDirectRoute = false;
                    
                    // Check if directRoutes is already loaded for this origin
                    if (!appState.directRoutes[origin.iata_code]) {
                        try {
                            // Fetch routes for this origin if not already available
                            console.log(`Fetching directRoutes for ${origin.iata_code}`);
                            await flightMap.fetchAndCacheRoutes(origin.iata_code);
                        } catch (error) {
                            console.error(`Error fetching direct routes for ${origin.iata_code}:`, error);
                        }
                    }
                    
                    // Now look for the direct route
                    const foundRoute = flightMap.findRoute(origin.iata_code, destination.iata_code);
                    isDirectRoute = !!foundRoute;
                    
                    console.log(`Route from ${origin.iata_code} to ${destination.iata_code} isDirect:`, isDirectRoute);
                    console.log('Found route:', foundRoute);
                    
                    if (foundRoute) {
                        const newRoute = {
                            ...foundRoute,
                            isDirect: true,
                            isSelected: isSelected,
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

        // Update state with new routes but using routeData as the source of truth
        console.log("Final routes array:", newRoutes);
        
        // Instead of directly updating the legacy routes array, update the routeData structure
        // with any additional route information we've calculated
        newRoutes.forEach((newRoute, index) => {
            if (appState.routeData[index] && !appState.routeData[index].isEmpty) {
                // Transfer any properties we need to preserve to routeData
                appState.routeData[index].isDirect = newRoute.isDirect;
                appState.routeData[index].price = newRoute.price;
            }
        });
        
        // For backward compatibility during transition, still update the routes array
        updateState('updateRoutes', newRoutes, 'routeHandling.updateRoutesArray');
        
        console.log('Updated routeData with route info:', appState.routeData);
        await pathDrawing.drawLines();
    }
};

export { routeHandling };

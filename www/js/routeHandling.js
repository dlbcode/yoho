import { appState, updateState } from './stateManager.js';
import { flightMap } from './flightMap.js';
import { pathDrawing } from './pathDrawing.js';
import { lineManager } from './lineManager.js';

const routeHandling = {
    updateRoutesArray: async function() {
        console.log("updateRoutesArray called, routeData:", appState.routeData);
        
        // Clear all existing route lines before drawing new ones
        lineManager.clearLines('route');
        
        // Initialize directRoutes if it doesn't exist
        if (!appState.directRoutes) {
            appState.directRoutes = {};
        }
        
        // Process each route in routeData - exclusively use routeData
        const validRoutes = appState.routeData.filter(r => r && !r.isEmpty);
        
        if (validRoutes.length === 0) {
            console.log("No valid routes found in routeData");
            // Keep an empty routes array for backward compatibility during transition
            updateState('updateRoutes', [], 'routeHandling.updateRoutesArray');
            return;
        }
        
        // Check for "Any" origins directly in routeData
        const hasAnyOrigin = validRoutes.some(r => r.origin && r.origin.iata_code === 'Any');
        
        // Create a new routes array to pass to updateRoutes
        let newRoutes = [];
        
        // Process each valid route in routeData
        for (let i = 0; i < validRoutes.length; i++) {
            const routeIndex = validRoutes[i] ? appState.routeData.indexOf(validRoutes[i]) : i;
            const route = validRoutes[i];
            
            // Skip if no origin or destination
            if (!route.origin && !route.destination) {
                console.log(`Skipping route ${routeIndex} - missing both origin and destination`);
                continue;
            }
            
            console.log(`Processing route ${routeIndex}:`, route);
            
            // Apply route direction logic if needed
            let origin = route.origin;
            let destination = route.destination;
            
            // If routeDirection is 'to' and we don't have "Any" origins, swap origin and destination
            if (appState.routeDirection === 'to' && !hasAnyOrigin) {
                [origin, destination] = [destination, origin];
                
                // Update the routeData to reflect this swap
                appState.routeData[routeIndex] = {
                    ...route,
                    origin: destination,
                    destination: origin
                };
            }
            
            // Check if this route has a selected route in routeData's own structure
            const isSelected = !!route.selectedRoute || !!appState.selectedRoutes[routeIndex];
            
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
                    if (route.selectedRoute?.displayData?.price) {
                        routeData.price = route.selectedRoute.displayData.price;
                    } else if (appState.selectedRoutes[routeIndex]?.displayData?.price) {
                        routeData.price = appState.selectedRoutes[routeIndex].displayData.price;
                    }
                }
                
                console.log(`Adding "Any" route ${routeIndex}:`, routeData);
                newRoutes[routeIndex] = routeData;
                continue;
            }
            
            // Get the selected route price if available
            let routePrice = null;
            if (isSelected) {
                // Use the selected route's price from routeData first, then fall back to selectedRoutes
                if (route.selectedRoute?.displayData?.price) {
                    routePrice = route.selectedRoute.displayData.price;
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
                
                if (foundRoute) {
                    const newRoute = {
                        ...foundRoute,
                        isDirect: true,
                        isSelected: isSelected,
                        price: routePrice !== null ? routePrice : foundRoute.price,
                        tripType: route.tripType || 'oneWay',
                        travelers: route.travelers || 1
                    };
                    console.log(`Adding direct route ${routeIndex}:`, newRoute);
                    newRoutes[routeIndex] = newRoute;
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
                    console.log(`Adding indirect route ${routeIndex}:`, newRoute);
                    newRoutes[routeIndex] = newRoute;
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
                console.log(`Adding partial route ${routeIndex}:`, newRoute);
                newRoutes[routeIndex] = newRoute;
            }
        }

        // Clean up undefined entries in the newRoutes array
        newRoutes = newRoutes.filter(Boolean);
        
        // Transfer any properties we need to preserve to routeData
        newRoutes.forEach((newRoute, index) => {
            const routeIndex = validRoutes[index] ? appState.routeData.indexOf(validRoutes[index]) : index;
            if (appState.routeData[routeIndex] && !appState.routeData[routeIndex].isEmpty) {
                // Transfer any properties we need to preserve to routeData
                appState.routeData[routeIndex].isDirect = newRoute.isDirect;
                appState.routeData[routeIndex].price = newRoute.price;
            }
        });
        
        // Update routes for backward compatibility
        updateState('updateRoutes', newRoutes, 'routeHandling.updateRoutesArray');
        
        console.log('Updated routeData with route info:', appState.routeData);
        
        // Draw the lines for the routes
        try {
            await pathDrawing.drawLines();
        } catch (error) {
            console.error('Error drawing lines:', error);
        }
    }
};

export { routeHandling };

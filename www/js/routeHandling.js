import { appState, updateState } from './stateManager.js';
import { flightMap } from './flightMap.js';
import { pathDrawing } from './pathDrawing.js';
import { lineManager } from './lineManager.js';

const routeHandling = {
    async updateRoutesArray() {
        // Clear any existing lines
        lineManager.clearLines('route');

        // Filter out empty route data
        const validRoutes = appState.routeData
            .filter(route => route && !route.isEmpty && 
                   (route.origin?.iata_code || route.destination?.iata_code));
        
        // Process routes and check for direct routes
        const processedRoutes = [];
        
        for (const route of validRoutes) {
            // Skip if missing origin or destination
            if (!route.origin?.iata_code || !route.destination?.iata_code) {
                processedRoutes.push({
                    origin: route.origin?.iata_code || null,
                    destination: route.destination?.iata_code || null,
                    tripType: route.tripType || 'oneWay',
                    travelers: route.travelers || 1,
                    isDirect: false,
                    isSelected: route.isSelected || false,
                    price: route.price || null,
                    routeNumber: validRoutes.indexOf(route)
                });
                continue;
            }
            
            // Make sure we have direct routes for this origin
            const originIata = route.origin.iata_code;
            const destIata = route.destination.iata_code;
            
            // Now check if this route is direct using flightMap directly
            const foundRoute = await flightMap.findRoute(originIata, destIata);
            const isDirect = !!foundRoute;
            
            // If direct, update the routeData with all relevant properties from foundRoute
            if (isDirect && route) {
                // Update all the properties that might affect line coloring
                route.isDirect = true;
                
                // Transfer price information if available
                if (foundRoute) {
                    route.price = foundRoute.price;
                    route.priceCategory = foundRoute.priceCategory;
                    route.priceLevel = foundRoute.priceLevel;
                    route.priceTier = foundRoute.priceTier;
                    route.priceUSD = foundRoute.priceUSD;
                    
                    // Copy any other properties that might be needed for line coloring
                    if (foundRoute.lineColor) route.lineColor = foundRoute.lineColor;
                    if (foundRoute.lineStyle) route.lineStyle = foundRoute.lineStyle;
                    if (foundRoute.lineWidth) route.lineWidth = foundRoute.lineWidth;
                }
            }
            
            // Create the processed route with all relevant properties from both route and foundRoute
            const processedRoute = {
                origin: originIata,
                destination: destIata,
                tripType: route.tripType || 'oneWay',
                travelers: route.travelers || 1,
                isDirect: isDirect,
                isSelected: route.isSelected || false,
                routeNumber: validRoutes.indexOf(route)
            };
            
            // Apply properties from foundRoute to the processed route if available
            if (foundRoute) {
                processedRoute.price = foundRoute.price;
                processedRoute.priceCategory = foundRoute.priceCategory;
                processedRoute.priceLevel = foundRoute.priceLevel;
                processedRoute.priceTier = foundRoute.priceTier;
                processedRoute.priceUSD = foundRoute.priceUSD;
                
                if (foundRoute.lineColor) processedRoute.lineColor = foundRoute.lineColor;
                if (foundRoute.lineStyle) processedRoute.lineStyle = foundRoute.lineStyle;
                if (foundRoute.lineWidth) processedRoute.lineWidth = foundRoute.lineWidth;
            } else {
                // Use existing price if available
                processedRoute.price = route.price || null;
            }
            
            processedRoutes.push(processedRoute);
        }
        
        // Draw the lines for the routes
        await pathDrawing.drawLines();
        
        // Dispatch a custom event to notify other components
        document.dispatchEvent(new CustomEvent('routesUpdated', {
            detail: { routes: processedRoutes }
        }));
        
        return processedRoutes;
    }
};

export { routeHandling };

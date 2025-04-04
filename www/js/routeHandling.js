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
            
            // Check if this route is direct using flightMap directly
            const foundRoute = await flightMap.findRoute(originIata, destIata);
            const isDirect = !!foundRoute;
            
            // Update the routeData with the isDirect property
            route.isDirect = isDirect;

            // Create the processed route with all relevant properties
            const processedRoute = {
                origin: originIata,
                destination: destIata,
                tripType: route.tripType || 'oneWay',
                travelers: route.travelers || 1,
                isDirect: isDirect,
                isSelected: route.isSelected || false,
                routeNumber: validRoutes.indexOf(route),
                price: foundRoute?.price || route.price || null
            };

            processedRoutes.push(processedRoute);

            // Draw the line with the correct type
            const type = isDirect ? 'route' : 'dashed';
            await pathDrawing.drawLine(`${originIata}-${destIata}`, type, {
                price: processedRoute.price,
                routeNumber: processedRoute.routeNumber,
                isDirect: processedRoute.isDirect
            });
        }

        // Dispatch a custom event to notify other components
        document.dispatchEvent(new CustomEvent('routesUpdated', {
            detail: { routes: processedRoutes }
        }));
        
        return processedRoutes;
    }
};

export { routeHandling };

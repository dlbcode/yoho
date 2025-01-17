import { appState, updateState } from './stateManager.js';
import { flightMap } from './flightMap.js';
import { pathDrawing } from './pathDrawing.js';
import { lineManager } from './lineManager.js';

const routeHandling = {
    updateRoutesArray: async function() {
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

            const route = flightMap.findRoute(fromWaypoint.iata_code, toWaypoint.iata_code);
            if (route) {
                newRoutes.push({
                    ...route,
                    isDirect: true,
                    tripType: appState.routes[i/2]?.tripType || 'oneWay'
                });
            } else {
                newRoutes.push({
                    origin: fromWaypoint.iata_code,
                    destination: toWaypoint.iata_code,
                    isDirect: false,
                    price: null,
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

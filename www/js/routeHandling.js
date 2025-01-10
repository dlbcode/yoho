import { appState, updateState } from './stateManager.js';
import { flightMap } from './flightMap.js';
import { pathDrawing } from './pathDrawing.js';
import { lineManager } from './lineManager.js';

const routeHandling = {
    updateRoutesArray: async function () {
        let newRoutes = [];

        const waypoints = appState.routeDirection === 'to' ? [...appState.waypoints].reverse() : appState.waypoints;

        // Batch fetch routes
        const uniqueIataCodes = [...new Set(waypoints.map(wp => wp.iata_code))];
        await Promise.all(
            uniqueIataCodes
                .filter(code => !appState.directRoutes[code])
                .map(code => flightMap.fetchAndCacheRoutes(code))
        );

        for (let i = 0; i < waypoints.length; i += 2) {
            const fromWaypoint = waypoints[i];
            const toWaypoint = waypoints[i + 1];

            if (!toWaypoint) {
                newRoutes.push({
                    origin: fromWaypoint.iata_code,
                    destination: 'Any',
                    isDirect: false,
                    price: null,
                    source: 'placeholder',
                    tripType: appState.routes[i / 2]?.tripType || 'oneWay',
                    timestamp: new Date().toISOString()
                });
                break;
            }

            let route = flightMap.findRoute(fromWaypoint.iata_code, toWaypoint.iata_code);

            if (route) {
                route.isDirect = true;
                if (!newRoutes.some(r => r.origin === route.origin && r.destination === route.destination)) {
                    newRoutes.push({
                        ...route,
                        tripType: appState.routes[i / 2]?.tripType || 'oneWay'
                    });
                }
            } else {
                const [originAirport, destinationAirport] = await Promise.all([
                    flightMap.getAirportDataByIata(fromWaypoint.iata_code),
                    flightMap.getAirportDataByIata(toWaypoint.iata_code)
                ]);

                if (originAirport && destinationAirport && originAirport.latitude && destinationAirport.latitude) {
                    const indirectRoute = {
                        origin: fromWaypoint.iata_code,
                        destination: toWaypoint.iata_code,
                        originAirport: originAirport,
                        destinationAirport: destinationAirport,
                        isDirect: false,
                        price: null,
                        source: 'indirect',
                        tripType: appState.routes[i / 2]?.tripType || 'oneWay',
                        timestamp: new Date().toISOString()
                    };
                    if (!newRoutes.some(r => r.origin === indirectRoute.origin && r.destination === indirectRoute.destination)) {
                        newRoutes.push(indirectRoute);
                    }
                }
            }
        }

        newRoutes = newRoutes.map((route, index) => ({
            ...route,
            tripType: appState.routes[index]?.tripType || route.tripType || 'oneWay'
        }));
        
        // Batch update and draw
        lineManager.clearLines('all');
        updateState('updateRoutes', newRoutes, 'routeHandling.updateRoutesArray');
        pathDrawing.drawLines(); // Will now use batched drawing
    }
};

export { routeHandling };

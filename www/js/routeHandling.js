import { appState, updateState } from './stateManager.js';
import { flightMap } from './flightMap.js';
import { pathDrawing } from './pathDrawing.js';

const routeHandling = {
    updateRoutesArray: async function () {
        let newRoutes = [];

        const waypoints = appState.routeDirection === 'to' ? [...appState.waypoints].reverse() : appState.waypoints;

        // Collect IATA codes for batch fetching
        const iataCodes = waypoints.map(waypoint => waypoint.iata_code);
        const uniqueIataCodes = [...new Set(iataCodes)];
        
        // Batch fetch routes for all unique IATA codes
        const fetchPromises = uniqueIataCodes.map(iataCode => {
          if (!appState.directRoutes[iataCode]) {
            return flightMap.fetchAndCacheRoutes(iataCode);
          }
        });
        
        await Promise.all(fetchPromises.filter(Boolean));        

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
        updateState('updateRoutes', newRoutes, 'routeHandling.updateRoutesArray');
        pathDrawing.clearLines(true);
        pathDrawing.drawLines();
    }
};

export { routeHandling };

import { appState, updateState } from './stateManager.js';
import { flightMap } from './flightMap.js';
import { pathDrawing } from './pathDrawing.js';

const routeHandling = {
    updateRoutesArray: async function () {
        let newRoutes = [];
        let fetchPromises = [];
        let partialRoutes = [];

        const waypoints = appState.routeDirection === 'to' ? [...appState.waypoints].reverse() : appState.waypoints;

        if (waypoints.length < 2) {
            console.log('Insufficient waypoints to form a route.');
            return; // Exit if there are not enough waypoints to form a route
        }

        console.log('Fetching routes for waypoints:', waypoints);

        for (let i = 0; i < waypoints.length; i++) {
            const fromWaypoint = waypoints[i];
            const toWaypoint = waypoints[i + 1];

            if (!toWaypoint) {
                // If there's no destination waypoint yet, retain this partial route
                partialRoutes.push({
                    origin: fromWaypoint.iata_code,
                    tripType: appState.routes.length > i ? appState.routes[i].tripType : 'roundTrip'
                });
                continue;
            }

            if (!appState.directRoutes[fromWaypoint.iata_code]) {
                fetchPromises.push(flightMap.fetchAndCacheRoutes(fromWaypoint.iata_code));
            }
            if (!appState.directRoutes[toWaypoint.iata_code]) {
                fetchPromises.push(flightMap.fetchAndCacheRoutes(toWaypoint.iata_code));
            }
        }

        await Promise.all(fetchPromises);

        for (let i = 0; i < waypoints.length - 1; i++) {
            const fromWaypoint = waypoints[i];
            const toWaypoint = waypoints[i + 1];
            let route = flightMap.findRoute(fromWaypoint.iata_code, toWaypoint.iata_code);

            if (route) {
                route.isDirect = true;
                newRoutes.push(route);
            } else {
                const [originAirport, destinationAirport] = await Promise.all([
                    flightMap.getAirportDataByIata(fromWaypoint.iata_code),
                    flightMap.getAirportDataByIata(toWaypoint.iata_code)
                ]);

                // Ensure originAirport and destinationAirport have necessary properties
                if (originAirport && destinationAirport && originAirport.latitude && destinationAirport.latitude) {
                    const indirectRoute = {
                        origin: fromWaypoint.iata_code,
                        destination: toWaypoint.iata_code,
                        originAirport: originAirport,
                        destinationAirport: destinationAirport,
                        isDirect: false,
                        price: null,
                        source: 'indirect',
                        timestamp: new Date().toISOString()
                    };
                    newRoutes.push(indirectRoute);
                }
            }
        }
        // Only update the state if newRoutes is not empty and different from the current state
        if (newRoutes.length > 0 && JSON.stringify(newRoutes) !== JSON.stringify(appState.routes)) {
            console.log('routeHandling.js: Updating routes array with new routes:', newRoutes);

            // Preserve tripType from the existing routes
            newRoutes = newRoutes.map((route, index) => ({
                ...route,
                tripType: appState.routes[index]?.tripType || 'oneWay'
            }));

            updateState('updateRoutes', newRoutes);
            pathDrawing.clearLines(true);
            pathDrawing.drawLines();
            document.dispatchEvent(new CustomEvent('routesArrayUpdated'));
        } else {
            console.log('No valid routes found to update or routes are the same as current state.');
        }
    }
};

export { routeHandling };

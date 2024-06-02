import { appState, updateState } from './stateManager.js';
import { flightMap } from './flightMap.js';
import { pathDrawing } from './pathDrawing.js';

const routeHandling = {
    updateRoutesArray: async function () {
        let newRoutes = [];
        let fetchPromises = [];
        let partialRoutes = [];

        const waypoints = appState.routeDirection === 'to' ? [...appState.waypoints].reverse() : appState.waypoints;

        for (let i = 0; i < waypoints.length; i++) {
            const fromWaypoint = waypoints[i];
            const toWaypoint = waypoints[i + 1];

            if (!toWaypoint) {
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

        if (newRoutes.length > 0 && !arraysEqual(newRoutes, appState.routes)) {
            newRoutes = newRoutes.map((route, index) => ({
                ...route,
                tripType: appState.routes[index]?.tripType || 'oneWay'
            }));
            updateState('updateRoutes', newRoutes, 'routeHandling.updateRoutesArray');
            pathDrawing.clearLines(true);
            pathDrawing.drawLines();
            document.dispatchEvent(new CustomEvent('routesArrayUpdated'));
        } else {
            console.log('No valid routes found to update or routes are the same as current state.');
        }
    }
};

function arraysEqual(arr1, arr2) {
    if (arr1.length !== arr2.length) return false;
    for (let i = 0; i < arr1.length; i++) {
        if (JSON.stringify(arr1[i]) !== JSON.stringify(arr2[i])) return false;
    }
    return true;
}

export { routeHandling };

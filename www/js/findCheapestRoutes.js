import { flightMap } from './flightMap.js';

const findCheapestRoutes = {

  async findCheapestRouteAndAddWaypoints(originIata, destinationIata) {
    console.log('Fetching cheapest routes for', originIata, destinationIata);
    try {
        const response = await fetch(`http://yonderhop.com:3000/cheapest-routes?origin=${originIata}&destination=${destinationIata}`);
        const cheapestRoutes = await response.json();

        if (cheapestRoutes && cheapestRoutes.length > 0) {
            // Start from index 1 if the first waypoint is the same as the last selected waypoint
            const startIndex = (cheapestRoutes[0].route[0] === originIata) ? 1 : 0;

            for (let i = startIndex; i < cheapestRoutes[0].route.length; i++) {
                const iataCode = cheapestRoutes[0].route[i];
                const airportData = await flightMap.getAirportDataByIata(iataCode);
                console.log('Cheapest Route AddWaypoint', airportData);
            }
        }
    } catch (error) {
        console.error('Error fetching cheapest routes:', error);
    }
  },
}

export { findCheapestRoutes };
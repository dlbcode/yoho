import { appState, updateState } from '../stateManager.js';
import { pathDrawing } from '../pathDrawing.js';
import { flightMap } from '../flightMap.js';

function routeInfoRow(flight, routeIndex) {
    console.log('routeInfoRow', flight, routeIndex);
    const infoPane = document.getElementById('infoPaneContent');
    const details = document.createElement('div');
    details.innerHTML = `
        <div>Route Details for ${flight.airlines.join(", ")}:</div>
        <div>Price: $${flight.price.toFixed(2)}</div>
        <button id="detailedView">Show Detailed View</button>
    `;
    const detailedButton = details.querySelector('#detailedView');
    detailedButton.addEventListener('click', () => {
        const routeIds = flight.id.split('|');
        const fullFlightData = flight;
    
        // Determine the group ID for the newly selected route
        appState.highestGroupId += 1;
        let newRouteGroupId = appState.highestGroupId;
        const existingRouteDetails = appState.selectedRoutes[routeIndex];
        if (existingRouteDetails) {
            // Logic to remove routes from the old group, if necessary
            Object.keys(appState.selectedRoutes).forEach(key => {
                if (appState.selectedRoutes[key].group === existingRouteDetails.group) {
                    updateState('removeSelectedRoute', parseInt(key));
                }
            });
        }
    
        // Update appState for the selected route
        routeIds.forEach((id, idx) => {
            const segmentData = fullFlightData.route[idx];
            const departureDate = new Date(segmentData.local_departure).toISOString().split('T')[0];
            const displayData = {
                departure: new Date(segmentData.local_departure).toLocaleString(),
                arrival: new Date(segmentData.local_arrival).toLocaleString(),
                price: `$${fullFlightData.price}`,
                airline: segmentData.airline,
                stops: fullFlightData.route.length - 1,
                route: `${segmentData.flyFrom} > ${segmentData.flyTo}`,
                deep_link: fullFlightData.deep_link,
            };
    
            const selectedRouteIndex = routeIndex + idx;
            if (!appState.routeDates[selectedRouteIndex]) {
                appState.routeDates[selectedRouteIndex] = departureDate;
            }
    
            if (appState.selectedRoutes.hasOwnProperty(selectedRouteIndex)) {
                const keys = Object.keys(appState.selectedRoutes).map(Number).filter(key => key >= selectedRouteIndex).sort((a, b) => b - a);
                keys.forEach(key => {
                    appState.selectedRoutes[key + 1] = appState.selectedRoutes[key]; // Shift each route up by one index
                });
            }
            
            appState.selectedRoutes[selectedRouteIndex] = {
                displayData: displayData,
                fullData: segmentData,
                group: newRouteGroupId !== null ? newRouteGroupId : routeIndex,
                routeDates: departureDate,
            };
        });
        //updateState('updateRouteDate: ', routeIndex, departureDate);
        //updateState('changeView', 'selectedRoute');
    });
    infoPane.appendChild(details);
}

export { routeInfoRow };

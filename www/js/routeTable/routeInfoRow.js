import { appState, updateState } from '../stateManager.js';
import { pathDrawing } from '../pathDrawing.js';
import { flightMap } from '../flightMap.js';

function routeInfoRow(flight, rowElement, routeIndex) {
    console.log('routeInfoRow called with:', flight, routeIndex);
    console.log('Row Element:', rowElement);
    console.log('Parent Node:', rowElement.parentNode);

    // Create a new row for detailed information
    const detailRow = document.createElement('tr');
    const detailCell = document.createElement('td');
    detailCell.colSpan = 9;  // Assuming there are 9 columns in your table
    detailCell.innerHTML = `
        <div>Route Details for ${flight.airlines.join(", ")}:</div>
        <div>Price: $${flight.price.toFixed(2)}</div>
        <button id="selectRoute">Select Route</button>
    `;
    detailRow.appendChild(detailCell);

    // Insert the new row right after the clicked row in the table
    if (rowElement.nextSibling) {
        rowElement.parentNode.insertBefore(detailRow, rowElement.nextSibling);
    } else {
        rowElement.parentNode.appendChild(detailRow);  // Append to the end if there's no next sibling
    }

    const selectRouteButton = detailCell.querySelector('#selectRoute');
    selectRouteButton.addEventListener('click', () => {
        const routeIds = flight.id.split('|');
        const fullFlightData = flight;

        console.log('routeIds:', routeIds);
        console.log('fullFlightData:', fullFlightData);
    
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
        updateState('updateRouteDate: ', routeIndex, departureDate);
        updateState('changeView', 'selectedRoute');
    });
}

export { routeInfoRow };

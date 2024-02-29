import { appState, updateState } from './stateManager.js';
import { setupAutocompleteForField, fetchAirportByIata } from './airportAutocomplete.js';
import { uiHandling } from './uiHandling.js';
import { flightMap } from './flightMap.js';
import { pathDrawing } from './pathDrawing.js';
import { routeList } from './routeList.js';
import { mapHandling } from './mapHandling.js';
import { leftPane } from './leftPane.js';

const routeHandling = {

    buildRouteDivs: function(routeNumber) {
        if (!appState.oneWay && document.querySelectorAll('.route-container').length >= 1) {
            return; // Exit the function if oneWay is false and a route div already exists
        }
        const container = document.querySelector('.airport-selection');
        const routeDivId = `route${routeNumber}`;
        let routeDiv = document.createElement('div');
        routeDiv.id = routeDivId;
        routeDiv.className = 'route-container';
        routeDiv.setAttribute('data-route-number', routeNumber.toString());
    
        // Define placeholders independently from the waypointsOrder
        let placeholders = ['From', 'To'];
    
        // Determine the order of waypoints based on routeDirection
        let waypointsOrder = appState.routeDirection === 'to' ? [1, 0] : [0, 1];
    
        for (let i = 0; i < 2; i++) {
            let index = (routeNumber - 1) * 2 + waypointsOrder[i];
            let waypoint = appState.waypoints[index];
            let input = document.createElement('input');
            input.type = 'text';
            input.id = `waypoint${index + 1}`;
            // Assign placeholders based on the original order, not waypointsOrder
            input.placeholder = placeholders[i];
            input.value = waypoint ? waypoint.iata_code : '';
    
            input.addEventListener('mouseover', async function() {
                const iataCode = this.value.match(/\b([A-Z]{3})\b/); // Extract IATA code using regex
                if (iataCode) {
                    const airportInfo = await fetchAirportByIata(iataCode[1]);
                    if (airportInfo) {
                        routeHandling.showWaypointTooltip(this, `${airportInfo.name} (${airportInfo.iata_code}) ${airportInfo.city}, ${airportInfo.country}`);
                    }
                }
            });
    
            input.addEventListener('mouseout', function() {
                routeHandling.hideWaypointTooltip();
            });
    
            routeDiv.appendChild(input);
    
            const suggestionsDiv = document.createElement('div');
            suggestionsDiv.id = `waypoint${index + 1}Suggestions`;
            suggestionsDiv.className = 'suggestions';
            routeDiv.appendChild(suggestionsDiv);
        }

        // Create a date selection button
        if (appState.oneWay) {
            let dateButton = document.createElement('button');
            dateButton.className = 'date-select-button';

            if (!appState.routeDates[routeNumber]) {
                if (routeNumber === 1) {
                    appState.routeDates[routeNumber] = new Date().toISOString().split('T')[0];
                } else {
                    // Ensure the date for the new route is at least the date of the previous route
                    appState.routeDates[routeNumber] = appState.routeDates[routeNumber - 1];
                }
            }

            dateButton.textContent = parseInt(appState.routeDates[routeNumber].split('-')[2]).toString();

            dateButton.addEventListener('click', function() {
                if (!this._flatpickr) {
                    let fp = flatpickr(this, {
                        enableTime: false,
                        dateFormat: "Y-m-d",
                        defaultDate: appState.routeDates[routeNumber], // Use the date from appState.routeDates
                        minDate: routeNumber === 1 ? "today" : appState.routeDates[routeNumber - 1], // Set minDate to previous route's date
                        onChange: (selectedDates) => {
                            const newDate = selectedDates[0];
                            this.textContent = new Date(newDate).getDate().toString();
                            const oldDate = appState.routeDates[routeNumber] ? new Date(appState.routeDates[routeNumber]) : new Date();
                            const dayDifference = (newDate - oldDate) / (1000 * 3600 * 24);
            
                            // Update the date for the current route
                            updateState('updateRouteDate', { routeNumber: routeNumber, date: newDate.toISOString().split('T')[0] });
            
                            // Adjust dates for subsequent routes
                            for (let i = routeNumber + 1; i <= Object.keys(appState.routeDates).length; i++) {
                                if (appState.routeDates[i]) {
                                    let subsequentDate = new Date(appState.routeDates[i]);
                                    subsequentDate.setDate(subsequentDate.getDate() + dayDifference);
                                    updateState('updateRouteDate', { routeNumber: i, date: subsequentDate.toISOString().split('T')[0] });
                                    routeHandling.updateDateButtonsDisplay();
                                }
                            }
                            updateState('updateRouteDate', { routeNumber: routeNumber, date: newDate.toISOString().split('T')[0] });
                            leftPane.refreshFlatpickrInstances();
                        }
                    });
                    fp.open();
                } else {
                    this._flatpickr.open();
                }
            }, {once: true});            
        
            routeDiv.insertBefore(dateButton, routeDiv.firstChild);
        }        

         // Create a swap button with a symbol
        let swapButton = document.createElement('button');
        swapButton.innerHTML = '&#8646;'; // Double-headed arrow symbol
        swapButton.className = 'swap-route-button';
        swapButton.onclick = () => this.handleSwapButtonClick(routeNumber);
        swapButton.title = 'Swap waypoints'; // Tooltip for accessibility

        // Insert the swap button between the waypoint input fields
        let firstInput = routeDiv.querySelector('input[type="text"]');
        routeDiv.insertBefore(swapButton, firstInput.nextSibling);
    
        // Add a minus button for each route div
        if (routeNumber > 1) {
            let minusButton = document.createElement('button');
            minusButton.textContent = '-';
            minusButton.className = 'remove-route-button';
            minusButton.onclick = () => this.removeRouteDiv(routeNumber);
            routeDiv.appendChild(minusButton);
        }
    
        // Add event listeners to change the route line color on mouseover
        routeDiv.addEventListener('mouseover', () => {
            const routeId = this.getRouteIdFromDiv(routeDiv);
            const pathLines = pathDrawing.routePathCache[routeId] || pathDrawing.dashedRoutePathCache[routeId];
            if (pathLines && pathLines.length > 0) {
                routeDiv.dataset.originalColor = pathLines[0].options.color;
                pathLines.forEach(path => path.setStyle({ color: 'white'}));
            }
        });
    
        routeDiv.addEventListener('mouseout', () => {
            const routeId = this.getRouteIdFromDiv(routeDiv);
            const pathLines = pathDrawing.routePathCache[routeId] || pathDrawing.dashedRoutePathCache[routeId];
            if (pathLines && pathLines.length > 0) {
                const originalColor = routeDiv.dataset.originalColor;
                pathLines.forEach(path => path.setStyle({ color: originalColor }));
            }
            pathDrawing.clearLines();
            pathDrawing.drawLines();
        });
    
        // Prepend the new route div so it appears above the last one if routeDirection is 'to'
        if (appState.routeDirection === 'to') {
            container.prepend(routeDiv);
        } else {
            container.appendChild(routeDiv);
        }
    
        for (let i = 0; i < 2; i++) {
            let index = (routeNumber - 1) * 2 + i;
            setupAutocompleteForField(`waypoint${index + 1}`);
        }
        uiHandling.setFocusToNextUnsetInput();
        uiHandling.toggleTripButtonsVisibility();
        uiHandling.getPriceButton();
    },

    updateDateButtonsDisplay: function() {
        document.querySelectorAll('.date-select-button').forEach((button, index) => {
            const routeNumber = index + 1;
            if (appState.routeDates[routeNumber]) {
                const date = appState.routeDates[routeNumber];
                button.textContent = parseInt(date.split('-')[2]).toString();
            }
        });
    },    
    
    handleSwapButtonClick: function(routeNumber) {
        let routeDiv = document.getElementById(`route${routeNumber}`);
        let inputs = routeDiv.querySelectorAll('input[type="text"]');
        if (inputs.length === 2) {
            // Swap the values of the input fields
            let temp = inputs[0].value;
            inputs[0].value = inputs[1].value;
            inputs[1].value = temp;
    
            // Update the appState.waypoints array
            let waypointIndex = (routeNumber - 1) * 2;
            [appState.waypoints[waypointIndex], appState.waypoints[waypointIndex + 1]] = 
                [appState.waypoints[waypointIndex + 1], appState.waypoints[waypointIndex]];
    
            routeHandling.updateRoutesArray();
        }
    },

    removeRouteDiv: function(routeNumber) {
        let routeDiv = document.getElementById(`route${routeNumber}`);
        if (routeDiv) {
            routeDiv.remove();
        }
    
        // Calculate the index for selectedRoutes based on the routeNumber
        let selectedRouteIndex = routeNumber - 1;
        let groupNumber = appState.selectedRoutes[selectedRouteIndex]?.group;
    
        // Remove all selectedRoutes with the same group number
        Object.keys(appState.selectedRoutes).forEach(key => {
            if (appState.selectedRoutes[key].group === groupNumber) {
                updateState('removeSelectedRoute', parseInt(key));
            }
        });
    
        // Remove the waypoints for the route being removed
        let waypointsIndex = (routeNumber - 1) * 2;
        if (appState.waypoints.length > waypointsIndex) {
            appState.waypoints.splice(waypointsIndex, 2); // Remove 2 waypoints starting from the calculated index
            updateState('updateWaypoint', appState.waypoints); // Update the state to reflect the change
        }

        // Remove the route date for the removed route
        delete appState.routeDates[routeNumber];
    
        // Re-index routeDates to fill the gap left by the removed route
        const newRouteDates = {};
        Object.keys(appState.routeDates).forEach((key, index) => {
            newRouteDates[index + 1] = appState.routeDates[key];
        });
        updateState('updateRouteDates', newRouteDates);

    
        // Additional logic to update the UI and application state as needed
        pathDrawing.clearLines();
        pathDrawing.drawLines();
        mapHandling.updateMarkerIcons();
        routeList.updateEstPrice();
        uiHandling.getPriceButton();
        this.updateRoutesArray();
    },
    
    getRouteIdFromDiv: function (routeDiv) {
        const inputs = routeDiv.querySelectorAll('input[type="text"]');
        if (inputs.length === 2) {
            const originIata = inputs[0].value;
            const destinationIata = inputs[1].value;
            return `${originIata}-${destinationIata}`;
        }
        return null;
    },

    showWaypointTooltip: function(element, text) {
        clearTimeout(this.tooltipTimeout);
    
        this.tooltipTimeout = setTimeout(() => {
            const tooltip = document.createElement('div');
            tooltip.className = 'waypointTooltip';
            tooltip.textContent = text;
            document.querySelector('.container').appendChild(tooltip);
    
            const rect = element.getBoundingClientRect();
            const containerRect = document.querySelector('.container').getBoundingClientRect();
    
            tooltip.style.position = 'absolute';
            tooltip.style.left = `${rect.left - containerRect.left}px`;
            tooltip.style.top = `${rect.bottom - containerRect.top}px`;
        }, 300);
    },
    
    hideWaypointTooltip: function() {
        clearTimeout(this.tooltipTimeout);
    
        document.querySelectorAll('.waypointTooltip').forEach(tooltip => {
            tooltip.remove();
        });
    },                        

    updateRoutesArray: async function () {
        let newRoutes = [];
        let fetchPromises = [];

        const waypoints = appState.routeDirection === 'to' ? [...appState.waypoints].reverse() : appState.waypoints;

        for (let i = 0; i < waypoints.length - 1; i += 2) {
            const fromWaypoint = waypoints[i];
            const toWaypoint = waypoints[i + 1];

            // Fetch and cache routes if not already done
            if (!appState.directRoutes[fromWaypoint.iata_code]) {
                fetchPromises.push(flightMap.fetchAndCacheRoutes(fromWaypoint.iata_code));
            }
            if (!appState.directRoutes[toWaypoint.iata_code]) {
                fetchPromises.push(flightMap.fetchAndCacheRoutes(toWaypoint.iata_code));
            }
        }

        await Promise.all(fetchPromises);

        // Now find and add routes
        for (let i = 0; i < waypoints.length - 1; i += 2) {
            const fromWaypoint = waypoints[i];
            const toWaypoint = waypoints[i + 1];
            let route = flightMap.findRoute(fromWaypoint.iata_code, toWaypoint.iata_code);

            if (route) {
                route.isDirect = true;
                newRoutes.push(route);
            } else {
                // Fetch airport data for both origin and destination
                const [originAirport, destinationAirport] = await Promise.all([
                    flightMap.getAirportDataByIata(fromWaypoint.iata_code),
                    flightMap.getAirportDataByIata(toWaypoint.iata_code)
                ]);

                // Create an indirect route with full airport information and additional fields
                const indirectRoute = {
                    origin: fromWaypoint.iata_code,
                    destination: toWaypoint.iata_code,
                    originAirport: originAirport,
                    destinationAirport: destinationAirport,
                    isDirect: false,
                    // Set default values for missing fields if necessary
                    price: null,
                    source: 'indirect',
                    timestamp: new Date().toISOString()
                };
                newRoutes.push(indirectRoute);
            }
        }

        updateState('updateRoutes', newRoutes);
        pathDrawing.clearLines();
        pathDrawing.drawLines();
        routeList.updateEstPrice();
        document.dispatchEvent(new CustomEvent('routesArrayUpdated'));
    },
    
    init: function() {
        this.buildRouteDivs(1); // Dynamically create the first route div
    },
}

document.addEventListener('stateChange', function(event) {
    if (event.detail.key === 'oneWay' && event.detail.value === false) {
        // Remove all waypoints except the first two
        appState.waypoints.splice(2);
        updateState('updateWaypoint', appState.waypoints);
        // Remove all route divs except the first one
        let routeDivs = document.querySelectorAll('.route-container');
        for (let i = 1; i < routeDivs.length; i++) {
            routeDivs[i].remove();
        }
    }
});

document.addEventListener('routeDatesUpdated', function() {
    routeHandling.updateDateButtonsDisplay();
});

export { routeHandling }
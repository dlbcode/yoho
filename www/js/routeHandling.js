import { appState, updateState } from './stateManager.js';
import { setupAutocompleteForField, fetchAirportByIata } from './airportAutocomplete.js';
import { uiHandling } from './uiHandling.js';
import { flightMap } from './flightMap.js';
import { pathDrawing } from './pathDrawing.js';
import { routeList } from './routeList.js';
import { mapHandling } from './mapHandling.js';
import { routeDateButtons } from './routeDateButtons.js';

const routeHandling = {

    buildRouteDivs: function(routeNumber) {
        routeNumber = routeNumber - 1;
        console.log('buildRouteDivs routeNumber: ',routeNumber);

        if (appState.waypoints.length === 0 && document.querySelectorAll('.route-container').length >= 1) {
            return; // Do not create a new route div if no waypoints are defined and a route div exists
        }

        const container = document.querySelector('.airport-selection');
        const routeDivId = `route${routeNumber}`;
        let routeDiv = document.createElement('div');
        routeDiv.id = routeDivId;
        routeDiv.className = 'route-container';
        routeDiv.setAttribute('data-route-number', routeNumber.toString());

        let placeholders = ['From', 'To'];

        let waypointsOrder = appState.routeDirection === 'to' ? [1, 0] : [0, 1];
    
        for (let i = 0; i < 2; i++) {
            let index = (routeNumber) * 2 + waypointsOrder[i];
            let waypoint = appState.waypoints[index];
            let input = document.createElement('input');
            input.type = 'text';
            input.id = `waypoint${index + 1}`;

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

        // Create a new div for the day name box
        let dayNameBox = document.createElement('div');
        dayNameBox.className = 'day-name-box';
        dayNameBox.setAttribute('data-route-number', routeNumber); // Store the route number on the element for reference

        // Check if a date exists for the routeNumber
        if (appState.routeDates[routeNumber]) {
            let dateParts = appState.routeDates[routeNumber].split('-');
            let initialDate = new Date(Date.UTC(dateParts[0], dateParts[1] - 1, dateParts[2]));
            let initialDayName = initialDate.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' })[0];
            dayNameBox.textContent = initialDayName;
        } else {
            // set the day name bpx to the value of the previous route's day name box
            let previousRouteNumber = routeNumber - 1;
            if (previousRouteNumber > 0) {
                let previousDayNameBox = document.querySelector(`.day-name-box[data-route-number="${previousRouteNumber}"]`);
                if (previousDayNameBox) {
                    dayNameBox.textContent = previousDayNameBox.textContent;
                }
            }
        }

        dayNameBox.style.width = '24px';
        dayNameBox.style.height = '36px';
        dayNameBox.style.display = 'flex';
        dayNameBox.style.alignItems = 'center';
        dayNameBox.style.padding = '2px';
        dayNameBox.style.cursor = 'pointer';
        
        dayNameBox.addEventListener('click', function() {
            // Find the date-select-button within the same routeDiv
            const dateSelectButton = routeDiv.querySelector('.date-select-button');
            if (dateSelectButton) {
                dateSelectButton.click(); // Programmatically trigger the click event on the button
            }
        });
        
        // Insert the day name box before the date button
        routeDiv.insertBefore(dayNameBox, routeDiv.firstChild);

        let dateButton = document.createElement('button');
        dateButton.className = 'date-select-button';

        console.log('appState.routeDates[routeNumber]: ',routeNumber, appState.routeDates[routeNumber]);

        const currentRouteDate = appState.routeDates.hasOwnProperty(routeNumber) ? 
            appState.routeDates[routeNumber] : 
            (routeNumber === 1 ? new Date().toISOString().split('T')[0] : appState.routeDates[routeNumber]);

        console.log('currentDate: ',currentRouteDate);

        if (!appState.routeDates.hasOwnProperty(routeNumber)) {
            appState.routeDates[routeNumber] = currentRouteDate;
        } else {
            appState.routeDates[routeNumber] = routeNumber === 0 ? new Date().toISOString().split('T')[0] : appState.routeDates[routeNumber];
        }

        //console.log('appState.routeDates[routeNumber]: ',appState.routeDates[routeNumber]);
        //console.log('currentDate: ',currentRouteDate);

        // Set the button text based on whether it's a date range or a single date
        dateButton.textContent = currentRouteDate ? (currentRouteDate.includes(' to ') ? '[...]' : new Date(currentRouteDate).getUTCDate().toString()) : new Date(currentRouteDate).getUTCDate().toString();
        dateButton.addEventListener('click', function() {
            if (!this._flatpickr) {
                const currentRouteDate = appState.routeDates[routeNumber];
                const isDateRange = currentRouteDate && currentRouteDate.includes(' to ');
                const timeZone = 'UTC'; // Specify your desired time zone, e.g., 'UTC', 'America/New_York'
                
                let fp = flatpickr(this, {
                    enableTime: false,
                    dateFormat: "Y-m-d",
                    defaultDate: isDateRange ? currentRouteDate.split(' to ')[0] : currentRouteDate,
                    minDate: routeNumber === 0 ? "today" : appState.routeDates[routeNumber],
                    mode: isDateRange ? "range" : "single",
                    onValueUpdate: (selectedDates) => {
                        if (selectedDates.length > 1 && selectedDates[0] && selectedDates[1]) {
                            this.textContent = '[...]';
                            const dateValue = `${selectedDates[0].toISOString().split('T')[0]} to ${selectedDates[1].toISOString().split('T')[0]}`;
                            updateState('updateRouteDate', { routeNumber: routeNumber, date: dateValue });
                        } else if (selectedDates.length === 1 && selectedDates[0]) {
                            const formatter = new Intl.DateTimeFormat('en-US', {
                                day: 'numeric',
                                timeZone: 'UTC'
                            });
                            this.textContent = formatter.format(selectedDates[0]);
                            const dateValue = selectedDates[0].toISOString().split('T')[0];
                            updateState('updateRouteDate', { routeNumber: routeNumber, date: dateValue });
                        } else {
                            // Handle the case where no dates are selected or the selection is cleared
                            this.textContent = 'Select Date'; // Reset the button text or handle as needed
                            updateState('updateRouteDate', { routeNumber: routeNumber, date: null }); // Update the state accordingly
                        }
                    },                                 
                    onReady: (selectedDates, dateStr, instance) => {
                        let prevMonthButton = instance.calendarContainer.querySelector('.flatpickr-prev-month');
                        let flexibleButton = document.createElement('button');
                        flexibleButton.textContent = isDateRange ? 'Single' : 'Flexible';
                        flexibleButton.className = 'flexible-button';
                        flexibleButton.style.marginRight = '10px';
                        prevMonthButton.parentNode.insertBefore(flexibleButton, prevMonthButton);
        
                        flexibleButton.addEventListener('click', () => {
                            const newMode = instance.config.mode === "single" ? "range" : "single";
                            instance.set("mode", newMode);
                            flexibleButton.textContent = newMode === "single" ? 'Flexible' : 'Single';
                            dateButton.textContent = newMode === "single" ? 'Select Date' : '[...]';
                            instance.clear();
                            instance.redraw();
                        });
        
                        if (isDateRange) {
                            const dates = currentRouteDate.split(' to ').map(dateStr => new Date(dateStr));
                            instance.setDate(dates, true);
                        }
                    }
                });
                fp.open();
            } else {
                this._flatpickr.open();
            }
        }, {once: true});           
        
        routeDiv.insertBefore(dateButton, dayNameBox.nextSibling);

        let swapButton = document.createElement('button');
        swapButton.innerHTML = '&#8646;'; // Double-headed arrow symbol
        swapButton.className = 'swap-route-button';
        swapButton.onclick = () => this.handleSwapButtonClick(routeNumber);
        swapButton.title = 'Swap waypoints'; // Tooltip for accessibility

        let firstInput = routeDiv.querySelector('input[type="text"]');
        routeDiv.insertBefore(swapButton, firstInput.nextSibling);

        if (routeNumber > 1) {
            let minusButton = document.createElement('button');
            minusButton.textContent = '-';
            minusButton.className = 'remove-route-button';
            minusButton.onclick = () => this.removeRouteDiv(routeNumber);
            routeDiv.appendChild(minusButton);
        }

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

        if (appState.routeDirection === 'to') {
            container.prepend(routeDiv);
        } else {
            container.appendChild(routeDiv);
        }

        for (let i = 0; i < 2; i++) {
            let index = (routeNumber) * 2 + i;
            setupAutocompleteForField(`waypoint${index + 1}`);
        }
        uiHandling.setFocusToNextUnsetInput();
        uiHandling.toggleTripButtonsVisibility();
        uiHandling.getPriceButton();
        routeDateButtons.updateDateButtons();
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
        console.log('Removing groupNumber', groupNumber);
    
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
            if (parseInt(key) < routeNumber) {
                newRouteDates[key] = appState.routeDates[key];
            } else if (parseInt(key) > routeNumber) {
                // Shift the dates down to fill the gap left by the removed route
                newRouteDates[parseInt(key) - 1] = appState.routeDates[key];
            }
        });
        appState.routeDates = newRouteDates;
        
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
    }
}
document.addEventListener('routeDatesUpdated', function() {
    routeDateButtons.updateDateButtonsDisplay();
});

export { routeHandling }
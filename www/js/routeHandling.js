import { appState, updateState, updateUrl } from './stateManager.js';
import { setupAutocompleteForField, fetchAirportByIata } from './airportAutocomplete.js';
import { uiHandling } from './uiHandling.js';
import { flightMap } from './flightMap.js';
import { pathDrawing } from './pathDrawing.js';
import { routeList } from './routeList.js';
import { mapHandling } from './mapHandling.js';
import { routeDateButtons } from './routeDateButtons.js';

const routeHandling = {

    buildRouteDivs: function(routeNumber) {
        if (!appState.urlDataLoaded) {
            return;
        }

        console.log('buildRouteDivs appState.routeDates #1: ', appState.routeDates);
        routeNumber = routeNumber - 1;

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

        console.log('buildRouteDivs appState.routeDates #2: ', appState.routeDates);

        // Check if the date includes a range
        const isDateRange = appState.routeDates[routeNumber] && appState.routeDates[routeNumber].includes(' to ');

        if (isDateRange) {
            let dateRange = appState.routeDates[routeNumber].split(' to ');
            let startDate = new Date(Date.UTC(...dateRange[0].split('-')));
            let endDate = new Date(Date.UTC(...dateRange[1].split('-')));
            let startDateFormatted = startDate.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
            let endDateFormatted = endDate.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
            dayNameBox.textContent = `${startDateFormatted} to ${endDateFormatted}`;
        } else {
            if (appState.routeDates && appState.routeDates[routeNumber]) {
                let dateParts = appState.routeDates[routeNumber].split('-');
                let initialDate = new Date(Date.UTC(...dateParts));
            let initialDayName = initialDate.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
            dayNameBox.textContent = initialDayName;
            }
        }
        
        dayNameBox.addEventListener('click', function() {
            const dateSelectButton = routeDiv.querySelector('.date-select-button');
            if (dateSelectButton) {
                dateSelectButton.click();
            }
        });
        
        routeDiv.insertBefore(dayNameBox, routeDiv.firstChild);

        let dateButton = document.createElement('button');
        dateButton.className = 'date-select-button';

        console.log('buildRouteDivs appState.routeDates.hasOwnProperty(routeNumber): ', appState.routeDates.hasOwnProperty(routeNumber));
        console.log('buildRouteDivs currentRouteNumber: ', routeNumber);
        console.log('buildRouteDivs appState.routeDates #3: ', appState.routeDates);
        console.log('buildRouteDivs appState.routeDates[routeNumber]: ', appState.routeDates[routeNumber]);

        const currentRouteDate = appState.routeDates.hasOwnProperty(routeNumber) ? appState.routeDates[routeNumber] :
                                (routeNumber === 0 ? new Date().toISOString().split('T')[0] : appState.routeDates[routeNumber - 1]);

        dateButton.textContent = currentRouteDate ? (currentRouteDate.includes(' to ') ? '[..]' : new Date(currentRouteDate).getUTCDate().toString()) : 'Select Date';
        console.log('currentRouteDate', currentRouteDate);

        const timeZone = 'UTC';
        let fp = flatpickr(dateButton, {
            disableMobile: true,
            enableTime: false,
            dateFormat: "Y-m-d",
            defaultDate: currentRouteDate,
            minDate: routeNumber === 0 ? "today" : appState.routeDates[routeNumber - 1],
            mode: currentRouteDate === 'any' ? 'any' : (currentRouteDate.includes(' to ') ? 'range' : 'single'),
            onValueUpdate: (selectedDates) => {
                console.log('selectedDates', selectedDates);
                let dateValue = null;
                if (selectedDates.length > 0 && selectedDates[0]) {
                    if (selectedDates.length > 1 && selectedDates[1]) {
                        this.textContent = '[..]';
                        dateValue = `${selectedDates[0].toISOString().split('T')[0]} to ${selectedDates[1].toISOString().split('T')[0]}`;
                    } else {
                        const formatter = new Intl.DateTimeFormat('en-US', { day: 'numeric', timeZone: 'UTC' });
                        this.textContent = formatter.format(selectedDates[0]);
                        dateValue = selectedDates[0].toISOString().split('T')[0];
                    }
                } else {
                    this.textContent = 'Select Date'; // Reset the button text or handle as needed
                }
                updateState('updateRouteDate', { routeNumber: routeNumber, date: dateValue }); // Update the state accordingly
            }, 
            onReady: (selectedDates, dateStr, instance) => {
                let prevMonthButton = instance.calendarContainer.querySelector('.flatpickr-prev-month');
                let dateModeSelectWrapper = document.createElement('div');
                dateModeSelectWrapper.className = 'select-wrapper';
                let dateModeSelect = document.createElement('div');
                dateModeSelect.className = 'date-mode-select';
                let selectedOption = document.createElement('div');
                selectedOption.className = 'selected-option';
                let options = ['Specific Date', 'Date Range', 'Any Dates'];
                let optionsContainer = document.createElement('div');
                optionsContainer.className = 'options';
                optionsContainer.style.display = 'none'; // Hide the options by default
                let selectedOptionText = document.createElement('div');
                selectedOptionText.style.paddingLeft = '4px';
                selectedOption.appendChild(selectedOptionText);

                options.forEach(option => {
                    let opt = document.createElement('div');
                    opt.style.paddingLeft = '4px';
                    opt.className = 'option';
                    let optText = document.createElement('div');
                    optText.textContent = option;
                    opt.appendChild(optText);
                    if ((isDateRange && option === 'Date Range') || (!isDateRange && option === 'Specific Date')) {
                        opt.classList.add('selected');
                        selectedOptionText.textContent = option; // Set the text of the selected option
                        opt.style.display = 'none'; // Hide the selected option
                    }
                    opt.addEventListener('click', (event) => {
                        event.stopPropagation();
                        let previousSelectedOption = optionsContainer.querySelector('.selected');
                        previousSelectedOption.classList.remove('selected');
                        previousSelectedOption.style.display = 'block'; // Show the previously selected option
                        opt.classList.add('selected');
                        selectedOptionText.textContent = opt.textContent;
                        optionsContainer.style.display = 'none';
                        opt.style.display = 'none';
                        dateModeSelect.dispatchEvent(new Event('change'));
                    });
                    optionsContainer.appendChild(opt);
                });

                dateModeSelect.appendChild(selectedOption)
                .appendChild(optionsContainer);
                dateModeSelectWrapper.appendChild(dateModeSelect);
                prevMonthButton.parentNode.insertBefore(dateModeSelectWrapper, prevMonthButton);

                // Show/hide the options when the dropdown is clicked
                dateModeSelect.addEventListener('click', () => {
                    optionsContainer.style.display = optionsContainer.style.display === 'none' ? 'block' : 'none';
                });

                dateModeSelect.addEventListener('change', () => {
                    const selectedOption = dateModeSelect.querySelector('.selected').textContent;
                    const isAnyDates = selectedOption === 'Any Dates';
                    const isSpecificDate = selectedOption === 'Specific Date';

                    if (isAnyDates) {
                        this.textContent = 'Any Dates';
                        updateState('updateRouteDate', { routeNumber: routeNumber, date: 'any' });
                        instance.close();
                    } else {
                        const newMode = isSpecificDate ? "single" : "range";
                        instance.set("mode", newMode);
                        this.textContent = newMode === "single" ? 'Select Date' : '[..]';
                        instance.clear();
                        instance.redraw();

                        const today = new Date();
                        const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
                        const dateToSet = newMode === "single" ? today : [today, nextWeek];
                        instance.setDate(dateToSet, true);
                    }
                });
            }
        });

        dateButton.addEventListener('click', function() {
            fp.open();
        }, {once: true});

        document.body.appendChild(dateButton);

        uiHandling.attachDateTooltip(dayNameBox, routeNumber);
        uiHandling.attachDateTooltip(dateButton, routeNumber);
        
        routeDiv.insertBefore(dateButton, dayNameBox.nextSibling);

        let swapButton = document.createElement('button');
        swapButton.innerHTML = '&#8646;'; // Double-headed arrow symbol
        swapButton.className = 'swap-route-button';
        swapButton.onclick = () => this.handleSwapButtonClick(routeNumber);
        swapButton.title = 'Swap waypoints'; // Tooltip for accessibility

        let firstInput = routeDiv.querySelector('input[type="text"]');
        routeDiv.insertBefore(swapButton, firstInput.nextSibling);

        let minusButton = document.createElement('button');
        minusButton.textContent = 'X'; // Change '-' to 'x'
        minusButton.className = 'remove-route-button';
        minusButton.onclick = () => this.removeRouteDiv(routeNumber);
        routeDiv.appendChild(minusButton);

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
            let waypointIndex = (routeNumber) * 2;
            [appState.waypoints[waypointIndex], appState.waypoints[waypointIndex + 1]] = 
                [appState.waypoints[waypointIndex + 1], appState.waypoints[waypointIndex]];
            routeHandling.updateRoutesArray();
            updateUrl();
        }
    },

    removeRouteDiv: function(routeNumber) {
        let routeDiv = document.getElementById(`route${routeNumber}`);
        if (routeDiv) {
            routeDiv.remove();
        }
    
        // Calculate the index for selectedRoutes based on the routeNumber
        let selectedRouteIndex = routeNumber;
        let groupNumber = appState.selectedRoutes[selectedRouteIndex]?.group;
    
        // Remove all selectedRoutes with the same group number
        Object.keys(appState.selectedRoutes).forEach(key => {
            if (appState.selectedRoutes[key].group === groupNumber) {
                updateState('removeSelectedRoute', parseInt(key));
            }
        });
    
        // Remove the waypoints for the route being removed
        let waypointsIndex = (routeNumber) * 2;
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
        pathDrawing.clearLines(true);
        pathDrawing.drawLines();
        mapHandling.updateMarkerIcons();
        routeList.updateEstPrice();
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
            document.body.appendChild(tooltip);

            const rect = element.getBoundingClientRect();
            const containerRect = document.querySelector('.container').getBoundingClientRect();

            tooltip.style.position = 'absolute';
            tooltip.style.left = `${rect.left - containerRect.left}px`;
            tooltip.style.top = `${rect.bottom - containerRect.top}px`;
        }, 200);
    },

    hideWaypointTooltip: function() {
        this.hideTooltipTimeout = setTimeout(() => {
            clearTimeout(this.tooltipTimeout);

            document.querySelectorAll('.waypointTooltip').forEach(tooltip => {
                tooltip.remove();
            });
        }, 20); // Adjust the delay as needed
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
        pathDrawing.clearLines(true);
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
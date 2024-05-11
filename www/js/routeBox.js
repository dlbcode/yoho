import { appState, updateState } from './stateManager.js';
import { setupAutocompleteForField, fetchAirportByIata } from './airportAutocomplete.js';
import { buildRouteTable } from './routeTable/routeTable.js';

// link and load the routeBox.css file
const link = document.createElement('link');
link.rel = 'stylesheet';
link.href = 'css/routeBox.css';
document.head.appendChild(link);

const routeBox = {
    showRouteBox: function(event, routeNumber) {
        let existingRouteBox = document.getElementById('routeBox');
        if (existingRouteBox) {
            existingRouteBox.remove();
        }

        let routeBox = document.createElement('div');
        routeBox.id = 'routeBox';
        routeBox.className = 'route-box-popup';
        document.body.appendChild(routeBox);

        if (routeNumber > 0 && !appState.waypoints[(routeNumber * 2)]) {
            let previousDestinationIndex = (routeNumber * 2) - 1;
            let previousDestination = appState.waypoints[previousDestinationIndex];
            if (previousDestination) {
                appState.waypoints[routeNumber * 2] = previousDestination;  // Set the previous destination as the current origin
            }
        }        

        // Create a new container for waypoint inputs
        let waypointInputsContainer = document.createElement('div');
        waypointInputsContainer.className = 'waypoint-inputs-container';
        routeBox.appendChild(waypointInputsContainer);

        let placeholders = ['From', 'To'];

        let waypointsOrder = appState.routeDirection === 'to' ? [1, 0] : [0, 1];
    
        for (let i = 0; i < 2; i++) {
            let index = (routeNumber) * 2 + waypointsOrder[i];
            let waypoint = appState.waypoints[index];
            let input = document.createElement('input');
            input.type = 'text';
            input.id = `waypoint-input-${index + 1}`;
            input.classList.add('waypoint-input');
            input.placeholder = placeholders[i];
            input.value = waypoint ? waypoint.iata_code : '';
        
            input.addEventListener('mouseover', async function() {
                const iataCode = this.value.match(/\b([A-Z]{3})\b/); // Extract IATA code using regex
                if (iataCode) {
                    const airportInfo = await fetchAirportByIata(iataCode[1]);
                    if (airportInfo) {
                        showWaypointTooltip(this, `${airportInfo.name} (${airportInfo.iata_code}) ${airportInfo.city}, ${airportInfo.country}`);
                    }
                }
            });
        
            input.addEventListener('mouseleave', () => {
                clearTimeout(tooltipTimeout);
                const tooltip = document.querySelector('.waypointTooltip');
                if (tooltip) {
                    tooltip.remove();
                }
            });
        
            waypointInputsContainer.appendChild(input);
            const suggestionsDiv = document.createElement('div');
            suggestionsDiv.id = `waypoint-input-${index + 1}Suggestions`;
            suggestionsDiv.className = 'suggestions';
            waypointInputsContainer.appendChild(suggestionsDiv);
        }
        
        // Setup autocomplete after all inputs are created
        for (let i = 0; i < 2; i++) {
            let index = (routeNumber) * 2 + i;
            setupAutocompleteForField(`waypoint-input-${index + 1}`);
        }
        
        // Date input setup with value populated from appState
        const currentRouteDate = appState.routeDates[routeNumber] || '';
        const isDateRange = appState.routeDates[routeNumber] && appState.routeDates[routeNumber].includes(' to ');
        
        let dateInput = document.createElement('input');
        dateInput.type = 'date';
        dateInput.id = 'depart-date-input';
        dateInput.value = currentRouteDate;
        dateInput.className = 'date-input';
        dateInput.placeholder = 'Date';
        dateInput.addEventListener('click', () => {
            fp.open(); // Ensure 'fp' (flatpickr instance) is defined and configured properly earlier in your script
        });
        routeBox.appendChild(dateInput);        

        let fp = flatpickr(dateInput, {
            disableMobile: true,
            enableTime: false,
            dateFormat: "Y-m-d",
            defaultDate: currentRouteDate,
            minDate: routeNumber === 0 ? "today" : appState.routeDates[routeNumber - 1],
            mode: currentRouteDate === 'any' ? 'any' : (currentRouteDate.includes(' to ') ? 'range' : 'single'),
            altInput: true,
            altFormat: "D, d M", // This will display the date as 'Fri, 10 May'
            onValueUpdate: function(selectedDates, dateStr) {
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
                instance.calendarContainer.classList.add('do-not-close-routebox');
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
                    if ((isDateRange && option === 'Date Range') || (!isDateRange && option === 'Specific Date' && currentRouteDate !== 'any') || (currentRouteDate === 'any' && option === 'Any Dates')) {
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
                        document.getElementById('depart-date-input').value = 'Any Dates'; // Directly updating the input field's value
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

        let fromInput = document.getElementById('waypoint-input-' + (routeNumber * 2 + 1));
        let toInput = document.getElementById('waypoint-input-' + (routeNumber * 2 + 2));

        if (!fromInput.value) {
            fromInput.focus();
        } else if (!toInput.value) {
            toInput.focus();
        }

        const closeButton = document.createElement('span');
        closeButton.innerHTML = '✕';
        closeButton.className = 'popup-close-button';
        closeButton.onclick = () => routeBox.style.display = 'none';
        routeBox.appendChild(closeButton);

        // add a search button to the route box
        let searchButton = document.createElement('button');
        searchButton.textContent = 'Search';
        searchButton.className = 'search-button';
        searchButton.onclick = () => {
            updateState('currentView', 'routeTable');
            buildRouteTable(routeNumber);
        }
 
        routeBox.appendChild(searchButton);

        this.positionPopup(routeBox, event);
        routeBox.style.display = 'block';
    },

    positionPopup: function(popup, event) {
        const iconRect = event.target.getBoundingClientRect();
        const popupWidth = popup.offsetWidth;
        const screenPadding = 10;

        let leftPosition = iconRect.left + window.scrollX - (popupWidth / 2) + (iconRect.width / 2);
        if (leftPosition + popupWidth > window.innerWidth - screenPadding) {
            leftPosition = window.innerWidth - popupWidth - screenPadding;
        } else if (leftPosition < screenPadding) {
            leftPosition = screenPadding;
        }

        popup.style.left = `${leftPosition}px`;
        popup.style.top = `${iconRect.top + window.scrollY - popup.offsetHeight - 10}px`; // Position above the icon
    },
}

document.addEventListener('click', function(event) {
    let routeBox = document.getElementById('routeBox');
    const routeNumber = appState.currentRouteIndex;
    let routeButton = document.getElementById(`route-button-${routeNumber}`);

    // Function to check if the event target or any of its parents have a specific class
    function hasParentWithClass(element, className) {
        while (element) {
            if (element.classList && element.classList.contains(className)) {
                return true;
            }
            element = element.parentNode;
        }
        return false;
    }

    // Check if the click was within elements that should not trigger closing
    if (routeBox && !routeBox.contains(event.target) && event.target !== routeButton && !hasParentWithClass(event.target, 'do-not-close-routebox')) {
        console.log('closing routeBox');
        routeBox.style.display = 'none';
    }
}, true);

let tooltipTimeout;

function showWaypointTooltip(element, text) {
    clearTimeout(tooltipTimeout);

    tooltipTimeout = setTimeout(() => {
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
}

export { routeBox };
import { appState, updateState } from './stateManager.js';
import { setupAutocompleteForField, fetchAirportByIata } from './airportAutocomplete.js';

// link and load the routeBox.css file
const link = document.createElement('link');
link.rel = 'stylesheet';
link.href = 'css/routeBox.css';
document.head.appendChild(link);

// In routeBox.js
const routeBox = {
    showRouteBox: function(event, routeNumber) {
        console.log('showRouteBox', routeNumber);
        let existingRouteBox = document.getElementById('routeBox');
        if (existingRouteBox) {
            existingRouteBox.remove();
        }

        let routeBox = document.createElement('div');
        routeBox.id = 'routeBox';
        routeBox.className = 'route-box-popup';
        document.body.appendChild(routeBox);

        let placeholders = ['From', 'To'];

        let waypointsOrder = appState.routeDirection === 'to' ? [1, 0] : [0, 1];
    
        for (let i = 0; i < 2; i++) {
            let index = (routeNumber) * 2 + waypointsOrder[i];
            let waypoint = appState.waypoints[index];
            let input = document.createElement('input');
            input.type = 'text';
            input.id = `waypoint-input-${index + 1}`;

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

            routeBox.appendChild(input);
    
            const suggestionsDiv = document.createElement('div');
            suggestionsDiv.id = `waypoint-input-${index + 1}Suggestions`;
            suggestionsDiv.className = 'suggestions';
            routeBox.appendChild(suggestionsDiv);
        }

        for (let i = 0; i < 2; i++) {
            let index = (routeNumber) * 2 + i;
            console.log('setting up autocomplete for waypoint', index + 1);
            setupAutocompleteForField(`waypoint-input-${index + 1}`);
        }

        const currentRouteDate = appState.routeDates[routeNumber] || 'any';
        const isDateRange = appState.routeDates[routeNumber] && appState.routeDates[routeNumber].includes(' to ');

        
        // add date field with the value of the route date for the current route
        let dateInput = document.createElement('input');
        dateInput.type = 'date';
        dateInput.id = 'depart-date-input';
        dateInput.value = appState.routeDates[routeNumber] || '';
        // open the date picker when the input is clicked
        dateInput.addEventListener('click', () => {
            fp.open();
        });
        dateInput.placeholder = 'Date';
        routeBox.appendChild(dateInput);

        let fp = flatpickr(dateInput, {
            disableMobile: true,
            enableTime: false,
            dateFormat: "Y-m-d",
            defaultDate: currentRouteDate,
            minDate: routeNumber === 0 ? "today" : appState.routeDates[routeNumber - 1],
            mode: currentRouteDate === 'any' ? 'any' : (currentRouteDate.includes(' to ') ? 'range' : 'single'),
            onValueUpdate: (selectedDates) => {
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
                console.log('updating route date', routeNumber, dateValue);
                console.log('routeDates', appState.routeDates);
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

        const closeButton = document.createElement('span');
        closeButton.innerHTML = '✕';
        closeButton.className = 'popup-close-button';
        closeButton.onclick = () => routeBox.style.display = 'none';
        routeBox.appendChild(closeButton);

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
    }
}

export { routeBox };
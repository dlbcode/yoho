import { appState, updateState, updateUrl } from '../stateManager.js';
import { setupAutocompleteForField, fetchAirportByIata } from '../airportAutocomplete.js';
import { buildRouteTable } from '../routeTable/routeTable.js';
import { initDatePicker } from './datePicker.js';
import { travelersPicker } from './travelersPicker.js';
import { tripTypePicker } from './tripTypePicker.js';
import { removeRoute } from './removeRoute.js';
import { routeHandling } from '../routeHandling.js';

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

        const topRow = document.createElement('div');
        topRow.id = 'topRow';
        topRow.className = 'top-row';
        routeBox.prepend(topRow);

        const tripTypeDropdown = tripTypePicker();
        topRow.appendChild(tripTypeDropdown);

        const travelersDropdown = travelersPicker(routeNumber);
        topRow.appendChild(travelersDropdown);

        // Create "From" and "To" tabs
        const tabsContainer = document.createElement('div');
        tabsContainer.className = 'tabs-container';
        const fromTab = document.createElement('div');
        fromTab.className = 'tab';
        fromTab.id = 'from-tab';
        fromTab.innerText = 'From';

        const toTab = document.createElement('div');
        toTab.className = 'tab';
        toTab.id = 'to-tab';
        toTab.innerText = 'To';

        const fromClearSpan = document.createElement('span');
        fromClearSpan.innerHTML = '✕';
        fromClearSpan.className = 'clear-span';
        fromTab.appendChild(fromClearSpan);

        const toClearSpan = document.createElement('span');
        toClearSpan.innerHTML = '✕';
        toClearSpan.className = 'clear-span';
        toTab.appendChild(toClearSpan);

        tabsContainer.appendChild(fromTab);
        tabsContainer.appendChild(toTab);
        routeBox.appendChild(tabsContainer);

        fromTab.addEventListener('click', () => this.handleTabClick('from', routeNumber));
        toTab.addEventListener('click', () => this.handleTabClick('to', routeNumber));

        // Create input fields
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
            input.value = waypoint ? waypoint.city + ', ' + waypoint.country + ' (' + waypoint.iata_code + ')' : '';

            input.oninput = function() {
                if (i === 0) {
                    fromClearSpan.style.display = input.value ? 'block' : 'none';
                } else {
                    toClearSpan.style.display = input.value ? 'block' : 'none';
                }
            };

            input.addEventListener('focus', function() {
                input.classList.add('focused');
                if (i === 0) {
                    fromTab.classList.add('active');
                    toTab.classList.remove('active');
                    fromClearSpan.style.display = input.value ? 'block' : 'none';
                } else {
                    toTab.classList.add('active');
                    fromTab.classList.remove('active');
                    toClearSpan.style.display = input.value ? 'block' : 'none';
                }
            });

            input.addEventListener('blur', function() {
                input.classList.remove('focused');
                if (i === 0) {
                    fromClearSpan.style.display = 'none';
                } else {
                    toClearSpan.style.display = 'none';
                }
                fromTab.classList.remove('active');
                toTab.classList.remove('active');
            });

            waypointInputsContainer.appendChild(input);

            const suggestionsDiv = document.createElement('div');
            suggestionsDiv.id = `waypoint-input-${index + 1}Suggestions`;
            suggestionsDiv.className = 'suggestions';
            waypointInputsContainer.appendChild(suggestionsDiv);
        }

        // Existing code to set up autocomplete and other elements
        for (let i = 0; i < 2; i++) {
            let index = (routeNumber) * 2 + i;
            setupAutocompleteForField(`waypoint-input-${index + 1}`);
        }

        // Adjust the swap button positioning
        let swapButton = document.createElement('button');
        swapButton.innerHTML = '&#8646;'; // Double-headed arrow symbol
        swapButton.className = 'swap-route-button';
        swapButton.onclick = () => handleSwapButtonClick(routeNumber);
        swapButton.title = 'Swap waypoints'; // Tooltip for accessibility

        // Place swap button between the two input wrappers
        let inputWrappers = waypointInputsContainer.querySelectorAll('.input-wrapper');
        if (inputWrappers.length === 2) {
            waypointInputsContainer.insertBefore(swapButton, inputWrappers[1]);
        }

        const currentRouteDate = appState.routeDates[routeNumber] || '';
        const isDateRange = appState.routeDates[routeNumber] && appState.routeDates[routeNumber].includes(' to ');

        const dateInputId = 'date-input';
        let dateInput = document.createElement('input');
        dateInput.type = 'date';
        dateInput.id = 'date-input';
        dateInput.value = currentRouteDate;
        dateInput.className = 'date-input';
        dateInput.placeholder = 'Date';
        routeBox.appendChild(dateInput);

        initDatePicker(dateInputId, routeNumber);

        let fromInput = document.getElementById('waypoint-input-' + (routeNumber * 2 + 1));
        let toInput = document.getElementById('waypoint-input-' + (routeNumber * 2 + 2));

        if (!fromInput.value) {
            fromInput.focus();
        } else if (!toInput.value) {
            toInput.focus();
        }

        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'button-container';  // This class will be used for CSS styling

        let searchButton = document.createElement('button');
        searchButton.textContent = 'Search';
        searchButton.className = 'search-button';
        searchButton.onclick = () => {
            const infoPaneContent = document.getElementById('infoPaneContent');
            infoPaneContent.innerHTML = '';
            updateState('currentView', 'routeTable');
            buildRouteTable(routeNumber);
        };

        let closeButton = document.createElement('span');
        closeButton.innerHTML = '✕';
        closeButton.className = 'popup-close-button';
        closeButton.onclick = () => routeBox.style.display = 'none';

        buttonContainer.appendChild(searchButton);
        buttonContainer.appendChild(closeButton); // If you want the close button next to search/remove

        // Assuming removeRouteButton appends the button inside the passed container
        removeRoute.removeRouteButton(buttonContainer, routeNumber);

        routeBox.appendChild(buttonContainer);

        this.positionPopup(routeBox, event);
        routeBox.style.display = 'block';
    },

    handleTabClick: function(tab, routeNumber) {
        const fromInput = document.getElementById('waypoint-input-' + (routeNumber * 2 + 1));
        const toInput = document.getElementById('waypoint-input-' + (routeNumber * 2 + 2));
        const fromClearSpan = document.querySelector('#from-tab .clear-span');
        const toClearSpan = document.querySelector('#to-tab .clear-span');
        if (tab === 'from') {
            setTimeout(() => {
                fromInput.focus();
                fromClearSpan.style.display = fromInput.value ? 'block' : 'none';
                toClearSpan.style.display = 'none';
            }, 100);
        } else {
            setTimeout(() => {
                toInput.focus();
                toClearSpan.style.display = toInput.value ? 'block' : 'none';
                fromClearSpan.style.display = 'none';
            }, 100);
        }
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
};

document.addEventListener('click', function(event) {
    let routeBox = document.getElementById('routeBox');
    const routeNumber = appState.currentRouteIndex;
    let routeButton = document.getElementById(`route-button-${routeNumber}`);

    function hasParentWithClass(element, className) {
        while (element) {
            if (element.classList && element.classList.contains(className)) {
                return true;
            }
            element = element.parentNode;
        }
        return false;
    }

    if (routeBox && !routeBox.contains(event.target) && event.target !== routeButton && !hasParentWithClass(event.target, 'do-not-close-routebox')) {
        routeBox.style.display = 'none';
    }
}, true);

function handleSwapButtonClick(routeNumber) {
    let waypointInputsContainer = document.getElementById('routeBox').querySelector('.waypoint-inputs-container');
    let inputs = waypointInputsContainer.querySelectorAll('input[type="text"]');
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
}

export { routeBox };

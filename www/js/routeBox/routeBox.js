import { appState, updateState, updateUrl } from '../stateManager.js';
import { setupAutocompleteForField } from '../airportAutocomplete.js';
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

const createElement = (tag, id, className, content) => {
    const element = document.createElement(tag);
    if (id) element.id = id;
    if (className) element.className = className;
    if (content) element.innerHTML = content;
    return element;
};

let blurTimeout;

const createWaypointInput = (index, placeholder, waypoint, routeNumber) => {
    const inputWrapper = createElement('div', null, 'input-wrapper');
    const input = createElement('input', `waypoint-input-${index + 1}`, 'waypoint-input');
    input.type = 'text';
    input.placeholder = placeholder;
    input.value = waypoint ? `${waypoint.city}, (${waypoint.iata_code})` : '';
    const clearSpan = createElement('span', null, 'clear-span', '✕');
    input.addEventListener('input', () => {
        if (input.value) {
            clearSpan.style.display = 'block';
        } else {
            clearSpan.style.display = 'none';
        }
    });
    input.addEventListener('focus', () => {
        if (input.value) {
            clearSpan.style.display = 'block';
        }
    });
    input.addEventListener('blur', () => {
        blurTimeout = setTimeout(() => {
            clearSpan.style.display = 'none';
        }, 200);
    });
    clearSpan.onclick = (e) => {
        e.stopPropagation();
        input.value = '';
    };
    inputWrapper.append(input, clearSpan, routeBox.createSuggestionsDiv(index));
    return inputWrapper;
};

const routeBox = {
    showRouteBox(event, routeNumber) {
        this.removeExistingRouteBox();
        const routeBox = this.createRouteBox();
        document.body.appendChild(routeBox);

        const topRow = createElement('div', 'topRow', 'top-row');
        topRow.append(tripTypePicker(), travelersPicker(routeNumber));
        routeBox.append(topRow);
        
        const waypointInputsContainer = createElement('div', null, 'waypoint-inputs-container');
        let firstEmptyInput = null;
        ['From', 'To'].forEach((placeholder, i) => {
            const index = routeNumber * 2 + i;
            if (i === 0 && appState.waypoints[index - 1]) {
                appState.waypoints[index] = appState.waypoints[index - 1];
            }
            const waypointInput = createWaypointInput(index, placeholder, appState.waypoints[index], routeNumber);
            // add From or To class to the input
            waypointInput.classList.add(i === 0 ? 'from-input' : 'to-input');
            waypointInputsContainer.append(waypointInput);
            if (!firstEmptyInput && !appState.waypoints[index]) {
                firstEmptyInput = waypointInput.querySelector('input');
            }
        });
        routeBox.append(waypointInputsContainer);

        waypointInputsContainer.insertBefore(this.createSwapButton(routeNumber), waypointInputsContainer.children[1]);

        const dateInput = createElement('input', `date-input-${routeNumber}`, 'date-input form-control input');
        dateInput.type = 'text';
        dateInput.readOnly = true;
        dateInput.placeholder = 'Date';
        let currentDate = new Date().toISOString().split('T')[0];
        dateInput.value = appState.routeDates[routeNumber - 1] || appState.routeDates[routeNumber] || currentDate;
        appState.routeDates[routeNumber] = dateInput.value;
        dateInput.name = `date-input-${routeNumber}`;
        dateInput.addEventListener('change', (e) => appState.routeDates[routeNumber] = e.target.value);
        routeBox.append(dateInput);
        initDatePicker(dateInput.id, routeNumber);

        const buttonContainer = createElement('div', null, 'button-container');
        buttonContainer.append(this.createSearchButton(routeNumber), this.createCloseButton(routeBox));
        removeRoute.removeRouteButton(buttonContainer, routeNumber);
        routeBox.append(buttonContainer);

        this.positionPopup(routeBox, event);
        routeBox.style.display = 'block';

        [`waypoint-input-${routeNumber * 2 + 1}`, `waypoint-input-${routeNumber * 2 + 2}`].forEach(id => setupAutocompleteForField(id));

        if (firstEmptyInput) firstEmptyInput.focus();
    },

    removeExistingRouteBox() {
        const existingRouteBox = document.getElementById('routeBox');
        if (existingRouteBox) existingRouteBox.remove();
    },

    createRouteBox() {
        return createElement('div', 'routeBox', 'route-box-popup');
    },

    createSwapButton(routeNumber) {
        const swapButtonWrapper = createElement('div', null, 'swap-button-wrapper');
        const swapButton = createElement('button', null, 'swap-route-button', '&#8646;');
        swapButton.title = 'Swap waypoints';
        swapButton.classList.add('disabled');
        swapButton.onclick = () => this.handleSwapButtonClick(routeNumber);
        swapButtonWrapper.appendChild(swapButton);
        return swapButtonWrapper;
    },

    createSuggestionsDiv(index) {
        return createElement('div', `waypoint-input-${index + 1}Suggestions`, 'suggestions');
    },

    createSearchButton(routeNumber) {
        const searchButton = createElement('button', null, 'search-button', 'Search');
        searchButton.onclick = () => {
            document.getElementById('infoPaneContent').innerHTML = '';
            updateState('currentView', 'routeTable');
            buildRouteTable(routeNumber);
        };
        return searchButton;
    },

    createCloseButton(routeBox) {
        const closeButton = createElement('span', null, 'popup-close-button', '✕');
        closeButton.onclick = () => routeBox.style.display = 'none';
        return closeButton;
    },

    positionPopup(popup, event) {
        const rect = event.target.getBoundingClientRect();
        const screenPadding = 10;
        let left = rect.left + window.scrollX - (popup.offsetWidth / 2) + (rect.width / 2);
        left = Math.min(Math.max(left, screenPadding), window.innerWidth - popup.offsetWidth - screenPadding);
        popup.style.left = `${left}px`;
        popup.style.top = `${rect.top + window.scrollY - popup.offsetHeight - 10}px`;
    },

    handleSwapButtonClick(routeNumber) {
        const inputs = document.querySelectorAll('.waypoint-inputs-container input[type="text"]');
        if (inputs.length === 2) {
            [inputs[0].value, inputs[1].value] = [inputs[1].value, inputs[0].value];
            const idx = routeNumber * 2;
            [appState.waypoints[idx], appState.waypoints[idx + 1]] = [appState.waypoints[idx + 1], appState.waypoints[idx]];
            routeHandling.updateRoutesArray();
            updateUrl();
        }
    },
};

document.addEventListener('click', (event) => {
    const routeBox = document.getElementById('routeBox');
    const routeButton = document.getElementById(`route-button-${appState.currentRouteIndex}`);
    if (routeBox && !routeBox.contains(event.target) && event.target !== routeButton &&
        !event.target.closest('.do-not-close-routebox')) {
        routeBox.style.display = 'none';
    }
}, true);

export { routeBox };

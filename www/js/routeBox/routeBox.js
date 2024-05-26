import { appState, updateState, updateUrl } from '../stateManager.js';
import { setupAutocompleteForField } from '../airportAutocomplete.js';
import { buildRouteTable } from '../routeTable/routeTable.js';
import { initDatePicker } from './datePicker.js';
import { travelersPicker } from './travelersPicker.js';
import { tripTypePicker, handleTripTypeChange } from './tripTypePicker.js';
import { removeRoute } from './removeRoute.js';
import { routeHandling } from '../routeHandling.js';

// Load CSS
const loadCSS = (href) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
};
loadCSS('css/routeBox.css');
loadCSS('css/datePicker.css');

// Create element helper
const createElement = (tag, { id, className, content } = {}) => {
    const element = document.createElement(tag);
    if (id) element.id = id;
    if (className) element.className = className;
    if (content) element.innerHTML = content;
    return element;
};

// Create waypoint input
const createWaypointInput = (index, placeholder, waypoint) => {
    const inputWrapper = createElement('div', { className: 'input-wrapper' });
    const input = createElement('input', { id: `waypoint-input-${index + 1}`, className: 'waypoint-input' });
    input.type = 'text';
    input.placeholder = placeholder;
    input.value = waypoint ? `${waypoint.city}, (${waypoint.iata_code})` : '';

    inputWrapper.append(input, routeBox.createSuggestionsDiv(index));
    return inputWrapper;
};

const enableSwapButtonIfNeeded = () => {
    const fromInput = document.querySelector('.from-input input');
    const toInput = document.querySelector('.to-input input');
    const swapButton = document.querySelector('.swap-route-button');
    const isEnabled = fromInput && toInput && fromInput.value.trim() && toInput.value.trim();
    swapButton.disabled = !isEnabled;
    swapButton.classList.toggle('disabled', !isEnabled);
};

const setupWaypointInputListeners = (routeNumber) => {
    ['from-input', 'to-input'].forEach((className, i) => {
        const input = document.querySelector(`#waypoint-input-${routeNumber * 2 + i + 1}`);
        input.addEventListener('input', enableSwapButtonIfNeeded);
        input.addEventListener('focus', (event) => {
            event.target.select();
        });
    });
    enableSwapButtonIfNeeded(); // Initial check
};

const routeBox = {
    showRouteBox(event, routeNumber) {
        this.removeExistingRouteBox();
        const routeBoxElement = this.createRouteBox();
        document.body.appendChild(routeBoxElement);

        const topRow = createElement('div', { id: 'topRow', className: 'top-row' });
        topRow.append(tripTypePicker(), travelersPicker(routeNumber));
        routeBoxElement.append(topRow);

        const waypointInputsContainer = createElement('div', { className: 'waypoint-inputs-container' });
        let firstEmptyInput = null;
        ['From', 'Where to?'].forEach((placeholder, i) => {
            const index = routeNumber * 2 + i;
            if (i === 0 && appState.waypoints[index - 1]) appState.waypoints[index] = appState.waypoints[index - 1];
            const waypointInput = createWaypointInput(index, placeholder, appState.waypoints[index]);
            waypointInput.classList.add(i === 0 ? 'from-input' : 'to-input');
            waypointInputsContainer.append(waypointInput);
            if (!firstEmptyInput && !appState.waypoints[index]) firstEmptyInput = waypointInput.querySelector('input');
        });
        routeBoxElement.append(waypointInputsContainer);
        waypointInputsContainer.insertBefore(this.createSwapButton(routeNumber), waypointInputsContainer.children[1]);

        const dateInputsContainer = createElement('div', { className: 'date-inputs-container' });
        routeBoxElement.append(dateInputsContainer);

        const buttonContainer = createElement('div', { className: 'button-container' });
        buttonContainer.append(this.createSearchButton(routeNumber), this.createCloseButton(routeBoxElement));
        removeRoute.removeRouteButton(buttonContainer, routeNumber);
        routeBoxElement.append(buttonContainer);

        this.positionPopup(routeBoxElement, event);
        routeBoxElement.style.display = 'block';

        [`waypoint-input-${routeNumber * 2 + 1}`, `waypoint-input-${routeNumber * 2 + 2}`].forEach(id => setupAutocompleteForField(id));
        if (firstEmptyInput) firstEmptyInput.focus();

        setupWaypointInputListeners(routeNumber);

        // Handle the initial trip type to display the appropriate date input fields
        handleTripTypeChange(appState.tripType);
    },

    removeExistingRouteBox() {
        const existingRouteBox = document.getElementById('routeBox');
        if (existingRouteBox) existingRouteBox.remove();
    },

    createRouteBox() {
        return createElement('div', { id: 'routeBox', className: 'route-box-popup' });
    },

    createSwapButton(routeNumber) {
        const swapButtonWrapper = createElement('div', { className: 'swap-button-wrapper' });
        const swapButton = createElement('button', { className: 'swap-route-button', content: '&#8646;', title: 'Swap waypoints', disabled: true });
        swapButton.classList.add('disabled');
        swapButton.onclick = () => this.handleSwapButtonClick(routeNumber);
        swapButtonWrapper.appendChild(swapButton);
        return swapButtonWrapper;
    },

    createSuggestionsDiv(index) {
        return createElement('div', { id: `waypoint-input-${index + 1}Suggestions`, className: 'suggestions' });
    },

    createSearchButton(routeNumber) {
        const searchButton = createElement('button', { className: 'search-button', content: 'Search' });
        searchButton.onclick = () => {
            document.getElementById('infoPaneContent').innerHTML = '';
            updateState('currentView', 'routeTable');
            buildRouteTable(routeNumber);
        };
        return searchButton;
    },

    createCloseButton(routeBox) {
        const closeButton = createElement('span', { className: 'popup-close-button' });
        closeButton.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 8L12 16L20 8" stroke="#666" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`;
        closeButton.onclick = () => routeBox.style.display = 'none';
        return closeButton;
    },

    createDateInput(routeNumber, dateType) {
        const dateInput = createElement('input', { id: `${dateType}-date-input-${routeNumber}`, className: 'date-input form-control input', type: 'text', readOnly: true, placeholder: `${dateType.charAt(0).toUpperCase() + dateType.slice(1)} Date` });
        const currentDate = new Date().toISOString().split('T')[0];
        dateInput.value = appState.routeDates[dateType] || currentDate;
        appState.routeDates[dateType] = dateInput.value;
        dateInput.name = `${dateType}-date-input-${routeNumber}`;
        dateInput.addEventListener('change', (e) => appState.routeDates[dateType] = e.target.value);
        return dateInput;
    },

    positionPopup(popup, event) {
        const rect = event.target.getBoundingClientRect();
        const screenPadding = 10;
        let left = rect.left + window.scrollX - (popup.offsetWidth / 2) + (rect.width / 2);
        left = Math.min(Math.max(left, screenPadding), window.innerWidth - popup.offsetWidth - screenPadding);
        popup.style.left = `${left - 10}px`;
        popup.style.top = `${rect.top + window.scrollY - popup.offsetHeight - 55}px`;
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

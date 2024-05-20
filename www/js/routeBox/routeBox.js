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

const setupInputEvents = (input, clearSpan, index, order) => {
    input.addEventListener('input', () => {
        clearSpan.style.display = input.value ? 'block' : 'none';
        routeBox.updateTabLabels();
    });
    input.addEventListener('change', routeBox.updateTabLabels);
    input.addEventListener('blur', () => {
        setTimeout(() => {
            if (!input.value) {
                updateState('removeWaypoint', index);
                routeBox.updateTabLabels();
            }
        }, 300);
    });
    input.addEventListener('focus', () => {
        clearSpan.style.display = input.value ? 'block' : 'none';
        routeBox.updateActiveTab(order === 0 ? 'from' : 'to');
        routeBox.updateInputVisibility();
    });
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
            e.preventDefault();
            document.getElementById(`waypoint-input-${order === 0 ? index + 2 : index}`).focus();
        }
    });
};

const routeBox = {
    showRouteBox(event, routeNumber) {
        this.removeExistingRouteBox();
        const routeBox = this.createRouteBox();
        document.body.appendChild(routeBox);

        const topRow = createElement('div', 'topRow', 'top-row');
        topRow.append(tripTypePicker(), travelersPicker(routeNumber));
        routeBox.append(topRow);

        const tabsContainer = createElement('div', null, 'tabs-container');
        tabsContainer.append(
            this.createTab('From', 'from-tab', routeNumber * 2),
            this.createSwapButton(routeNumber),
            this.createTab('To', 'to-tab', routeNumber * 2 + 1)
        );
        routeBox.append(tabsContainer);
        this.setupTabSwitching(routeNumber);

        const waypointInputsContainer = createElement('div', null, 'waypoint-inputs-container');
        ['From', 'To'].forEach((placeholder, i) => {
            const index = routeNumber * 2 + i;
            waypointInputsContainer.append(this.createWaypointInput(index, placeholder, appState.waypoints[index], i));
        });
        routeBox.append(waypointInputsContainer);

        const dateInput = createElement('input', 'date-input', 'date-input');
        dateInput.type = 'date';
        dateInput.value = appState.routeDates[routeNumber] || '';
        dateInput.placeholder = 'Date';
        routeBox.append(dateInput);
        initDatePicker(dateInput.id, routeNumber);

        const buttonContainer = createElement('div', null, 'button-container');
        buttonContainer.append(
            this.createSearchButton(routeNumber),
            this.createCloseButton(routeBox)
        );
        removeRoute.removeRouteButton(buttonContainer, routeNumber);
        routeBox.append(buttonContainer);

        this.positionPopup(routeBox, event);
        routeBox.style.display = 'block';
        this.updateInputVisibility();
        this.updateTabLabels();

        // Ensure elements exist before setting up autocomplete
        ['waypoint-input-1', 'waypoint-input-2'].forEach(id => setupAutocompleteForField(id));
    },

    removeExistingRouteBox() {
        const existingRouteBox = document.getElementById('routeBox');
        if (existingRouteBox) existingRouteBox.remove();
    },

    createRouteBox() {
        return createElement('div', 'routeBox', 'route-box-popup');
    },

    createTab(text, tabId, waypointIndex) {
        const tab = createElement('div', tabId, 'tab', this.getTabLabelText(text, waypointIndex));
        return tab;
    },

    getTabLabelText(text, waypointIndex) {
        const waypoint = appState.waypoints[waypointIndex];
        return waypoint ? `${text} ${waypoint.iata_code}` : text;
    },

    createSwapButton(routeNumber) {
        const swapButton = createElement('button', null, 'swap-route-button', '&#8646;');
        swapButton.title = 'Swap waypoints';
        swapButton.onclick = () => this.handleSwapButtonClick(routeNumber);
        return swapButton;
    },

    setupTabSwitching(routeNumber) {
        ['from-tab', 'to-tab'].forEach((tabId, index) => {
            document.getElementById(tabId).addEventListener('click', () => this.handleTabClick(index === 0 ? 'from' : 'to', routeNumber));
        });
    },

    handleTabClick(tab, routeNumber) {
        const { fromInput, toInput } = this.getWaypointInputs(routeNumber);
        const activeInput = tab === 'from' ? fromInput : toInput;
        this.updateActiveTab(tab);
        setTimeout(() => activeInput.focus({ preventScroll: true }), 0);
        this.updateInputVisibility();
    },

    getWaypointInputs(routeNumber) {
        return {
            fromInput: document.getElementById(`waypoint-input-${routeNumber * 2 + 1}`),
            toInput: document.getElementById(`waypoint-input-${routeNumber * 2 + 2}`)
        };
    },

    updateActiveTab(activeTab) {
        document.getElementById('from-tab').classList.toggle('active', activeTab === 'from');
        document.getElementById('to-tab').classList.toggle('active', activeTab === 'to');
    },

    createWaypointInput(index, placeholder, waypoint, order) {
        const inputWrapper = createElement('div', null, 'input-wrapper');
        const input = createElement('input', `waypoint-input-${index + 1}`, 'waypoint-input');
        input.type = 'text';
        input.placeholder = placeholder;
        input.value = waypoint ? `${waypoint.city}, ${waypoint.country} (${waypoint.iata_code})` : '';
        const clearSpan = createElement('span', null, 'clear-span', '✕');
        clearSpan.style.zIndex = '10';
        clearSpan.style.display = 'none';
        clearSpan.onclick = (e) => {
            e.stopPropagation();
            input.value = '';
            clearSpan.style.display = 'none';
            updateState('removeWaypoint', index);
            this.updateTabLabels();
            input.focus();
        };
        setupInputEvents(input, clearSpan, index, order);
        inputWrapper.append(input, clearSpan, this.createSuggestionsDiv(index));
        return inputWrapper;
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

    updateTabLabels() {
        const fromTab = document.getElementById('from-tab');
        const toTab = document.getElementById('to-tab');
        fromTab.innerText = this.getTabLabelText('From', 0);
        toTab.innerText = this.getTabLabelText('To', 1);
        document.getElementById('waypoint-input-2').placeholder = appState.waypoints[0] && !appState.waypoints[1] ? 'Any' : 'To';
    },

    updateInputVisibility() {
        const fromWrapper = document.getElementById('waypoint-input-1').parentElement;
        const toWrapper = document.getElementById('waypoint-input-2').parentElement;
        const fromActive = document.getElementById('from-tab').classList.contains('active');
        const toActive = document.getElementById('to-tab').classList.contains('active');
        fromWrapper.style.display = fromActive || !toActive ? 'block' : 'none';
        fromWrapper.style.width = fromActive ? '100%' : '50%';
        toWrapper.style.display = toActive || !fromActive ? 'block' : 'none';
        toWrapper.style.width = toActive ? '100%' : '50%';
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
            this.updateTabLabels();
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

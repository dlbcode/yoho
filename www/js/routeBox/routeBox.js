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

let switchingTabs = false;
let isFocusing = false;

const setupInputEvents = (input, clearSpan, index, routeNumber) => {
    input.setAttribute('tabindex', '0');
    input.addEventListener('input', () => {
        clearSpan.style.display = input.value ? 'block' : 'none';
        routeBox.updateTabLabels(routeNumber);
    });
    input.addEventListener('change', () => routeBox.updateTabLabels(routeNumber));
    input.addEventListener('blur', () => {
        if (!isFocusing && !switchingTabs) {
            if (!input.value) {
                updateState('removeWaypoint', index);
                routeBox.updateTabLabels(routeNumber);
            }
            clearSpan.style.display = 'none';
            routeBox.updateActiveTab('');
            routeBox.updateInputVisibility(routeNumber);
        }
    });
    input.addEventListener('focus', () => {
        isFocusing = true;
        setTimeout(() => isFocusing = false, 0);
        switchingTabs = false;
        hideAllClearButtons();
        clearSpan.style.display = 'block';
        routeBox.updateActiveTab(index % 2 === 0 ? 'from' : 'to');
        routeBox.updateInputVisibility(routeNumber);
    });
};

const hideAllClearButtons = () => {
    document.querySelectorAll('.clear-span').forEach(span => span.style.display = 'none');
};

const createWaypointInput = (index, placeholder, waypoint, routeNumber) => {
    const inputWrapper = createElement('div', null, 'input-wrapper');
    const input = createElement('input', `waypoint-input-${index + 1}`, 'waypoint-input');
    input.type = 'text';
    input.placeholder = placeholder;
    input.value = waypoint ? `${waypoint.city}, ${waypoint.country} (${waypoint.iata_code})` : '';
    const clearSpan = createElement('span', null, 'clear-span', '✕');
    clearSpan.style.display = input.value ? 'block' : 'none';
    clearSpan.onclick = (e) => {
        console.log('clearSpan.onclick');  // Debugging log
        e.stopPropagation();
        input.value = '';
        clearSpan.style.display = 'none';
        updateState('removeWaypoint', index);
        routeBox.updateTabLabels(routeNumber);
        input.focus();
    };
    setupInputEvents(input, clearSpan, index, routeNumber);
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

        const tabsContainer = createElement('div', null, 'tabs-container');
        tabsContainer.append(
            this.createTab('From', 'from-tab', routeNumber * 2, routeNumber),
            this.createSwapButton(routeNumber),
            this.createTab('To', 'to-tab', routeNumber * 2 + 1, routeNumber)
        );
        routeBox.append(tabsContainer);
        this.setupTabSwitching(routeNumber);

        const waypointInputsContainer = createElement('div', null, 'waypoint-inputs-container');
        let firstEmptyInput = null;
        ['From', 'To'].forEach((placeholder, i) => {
            const index = routeNumber * 2 + i;
            if (i === 0 && appState.waypoints[index - 1]) {
                appState.waypoints[index] = appState.waypoints[index - 1];
            }
            const waypointInput = createWaypointInput(index, placeholder, appState.waypoints[index], routeNumber);
            waypointInputsContainer.append(waypointInput);
            if (!firstEmptyInput && !appState.waypoints[index]) {
                firstEmptyInput = waypointInput.querySelector('input');
            }
        });
        routeBox.append(waypointInputsContainer);

        const dateInput = createElement('input', `date-input-${routeNumber}`, 'date-input form-control input');
        dateInput.type = 'text';
        dateInput.readOnly = true;
        dateInput.placeholder = 'Date';
        dateInput.value = appState.routeDates[routeNumber - 1] || appState.routeDates[routeNumber] || '';
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
        this.updateInputVisibility(routeNumber);
        this.updateTabLabels(routeNumber);

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

    createTab(text, tabId, waypointIndex, routeNumber) {
        const tab = createElement('div', tabId, 'tab', this.getTabLabelText(text, waypointIndex));
        tab.setAttribute('tabindex', '-1');
        tab.addEventListener('click', () => this.handleTabClick(tabId, routeNumber));
        return tab;
    },

    getTabLabelText(text, waypointIndex) {
        const waypoint = appState.waypoints[waypointIndex];
        return waypoint ? `${text} ${waypoint.iata_code}` : text;
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

    setupTabSwitching(routeNumber) {
        ['from-tab', 'to-tab'].forEach(tabId => {
            document.getElementById(tabId).addEventListener('click', () => this.handleTabClick(tabId, routeNumber));
        });
    },

    handleTabClick(tabId, routeNumber) {
        switchingTabs = true;
        const activeTab = tabId.includes('from') ? 'from' : 'to';
        this.updateActiveTab(activeTab);
        const inputId = activeTab === 'from' ? `waypoint-input-${routeNumber * 2 + 1}` : `waypoint-input-${routeNumber * 2 + 2}`;
        const input = document.getElementById(inputId);
        input.focus({ preventScroll: true });
        switchingTabs = false;

        document.querySelectorAll('.waypoint-inputs-container .input-wrapper').forEach(wrapper => {
            wrapper.style.width = wrapper.contains(input) ? '100%' : '50%';
        });

        this.updateInputVisibility(routeNumber);
    },

    updateActiveTab(activeTab) {
        const fromTab = document.getElementById('from-tab');
        const toTab = document.getElementById('to-tab');
        if (fromTab && toTab) {
            fromTab.classList.toggle('active', activeTab === 'from');
            toTab.classList.toggle('active', activeTab === 'to');
            if (!activeTab) {
                fromTab.classList.remove('active');
                toTab.classList.remove('active');
            }
        }
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

    updateTabLabels(routeNumber) {
        const fromTab = document.getElementById('from-tab');
        const toTab = document.getElementById('to-tab');
        const fromWaypointIndex = routeNumber * 2;
        const toWaypointIndex = routeNumber * 2 + 1;

        if (fromTab && toTab) {
            fromTab.innerText = this.getTabLabelText('From', fromWaypointIndex);
            toTab.innerText = appState.waypoints[toWaypointIndex] ? `To ${appState.waypoints[toWaypointIndex].iata_code}` : 'To Any';
        }

        const toInput = document.getElementById(`waypoint-input-${toWaypointIndex + 1}`);
        if (toInput) {
            toInput.placeholder = appState.waypoints[fromWaypointIndex] && !appState.waypoints[toWaypointIndex] ? 'Any' : 'To';
        }

        this.updateInputVisibility(routeNumber);

        const swapButton = document.querySelector('.swap-route-button');
        const fromTabHasIata = fromTab && fromTab.innerText.split(' ').length > 1;
        const toTabHasIata = toTab && toTab.innerText.split(' ').length > 1;
        const fromTabIata = fromTabHasIata ? fromTab.innerText.split(' ')[1] : null;
        const toTabIata = toTabHasIata ? toTab.innerText.split(' ')[1] : null;

        const isEnabled = fromTabIata && toTabIata && fromTabIata !== 'Any' && toTabIata !== 'Any';
        swapButton.disabled = !isEnabled;
        swapButton.classList.toggle('disabled', !isEnabled);
    },

    updateInputVisibility(routeNumber) {
        const fromInput = document.getElementById(`waypoint-input-${routeNumber * 2 + 1}`);
        const toInput = document.getElementById(`waypoint-input-${routeNumber * 2 + 2}`);

        if (fromInput && toInput) {
            const fromWrapper = fromInput.parentElement;
            const toWrapper = toInput.parentElement;
            const fromActive = document.getElementById('from-tab').classList.contains('active');
            const toActive = document.getElementById('to-tab').classList.contains('active');

            fromWrapper.style.display = fromActive || !toActive ? 'block' : 'none';
            fromWrapper.style.width = fromActive ? '100%' : '50%';

            toWrapper.style.display = toActive || !fromActive ? 'block' : 'none';
            toWrapper.style.width = toActive ? '100%' : '50%';
        }
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
            this.updateTabLabels(routeNumber);
        }
    },
};

document.addEventListener('click', (event) => {
    const routeBox = document.getElementById('routeBox');
    const routeButton = document.getElementById(`route-button-${appState.currentRouteIndex}`);
    if (routeBox && !routeBox.contains(event.target) && event.target !== routeButton &&
        !event.target.closest('.do-not-close-routebox')) {
        routeBox.style.display = 'none';
        hideAllClearButtons();
    }
}, true);

export { routeBox };

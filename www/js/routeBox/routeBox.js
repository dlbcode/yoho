import { appState, updateState, updateUrl } from '../stateManager.js';
import { setupAutocompleteForField } from '../airportAutocomplete.js';
import { buildRouteTable } from '../routeTable/routeTable.js';
import { initDatePicker } from './datePicker.js';
import { travelersPicker } from './travelersPicker.js';
import { tripTypePicker, handleTripTypeChange } from './tripTypePicker.js';
import { removeRoute, removeRouteButton } from './removeRoute.js';
import { routeHandling } from '../routeHandling.js';

const loadCSS = (href) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
};
loadCSS('css/routeBox.css');
loadCSS('css/datePicker.css');

const createElement = (tag, { id, className, content } = {}) => {
    const element = document.createElement(tag);
    if (id) element.id = id;
    if (className) element.className = className;
    if (content) element.innerHTML = content;
    return element;
};

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
        input.addEventListener('input', () => {
            enableSwapButtonIfNeeded();
        });

        input.addEventListener('focus', (event) => {
            if (window.innerWidth <= 600) {
                expandInput(event.target);
            }
            setTimeout(() => event.target.select(), 0);
        });

        input.addEventListener('blur', async (event) => {
            if (window.innerWidth <= 600) {
                revertInput(event.target);
            }
            const fromInput = document.querySelector(`#waypoint-input-${routeNumber * 2 + 1}`);
            const toInput = document.querySelector(`#waypoint-input-${routeNumber * 2 + 2}`);
            if (input.value === '' && fromInput.value !== '' && toInput.value !== '' && appState.waypoints.length > 0) {
                const waypointIndex = parseInt(input.id.replace('waypoint-input-', '')) - 1;
                if (waypointIndex >= 0 && waypointIndex < appState.waypoints.length) {
                    if (appState.waypoints[waypointIndex].iata_code !== '') {
                        updateState('removeWaypoint', waypointIndex, 'routeBox.setupWaypointInputListeners');
                        routeHandling.updateRoutesArray();
                    }
                }
            }
            input.disabled = true; // Temporarily disable the input
            updateUrl(); // Explicitly update the URL on blur
            setTimeout(() => {
                input.disabled = false; // Re-enable the input
            }, 300); // Delay to ensure the URL update is fully processed
        });
    });
    enableSwapButtonIfNeeded(); // Initial check
};

const expandInput = (input) => {
    input.classList.add('expanded-input');
    const suggestionsDiv = document.getElementById(`${input.id}Suggestions`);
    if (suggestionsDiv) {
        suggestionsDiv.classList.add('expanded-suggestions');
    }
    const inputWrapper = input.parentElement;
    const backButton = document.createElement('button');
    backButton.classList.add('back-button');
    backButton.innerHTML = `
        <svg viewBox="0 0 24 24">
            <line x1="22" y1="12" x2="4" y2="12" />
            <line x1="12" y1="3" x2="3" y2="12" />
            <line x1="12" y1="21" x2="3" y2="12" />
        </svg>
    `;

    let backButtonClicked = false;

    backButton.onclick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        backButtonClicked = true;
        input.disabled = true; // Temporarily disable the input
        input.blur();
        setTimeout(() => {
            input.disabled = false; // Re-enable the input
            backButtonClicked = false;
        }, 500); // Delay to ensure the blur event is fully processed
    };

    inputWrapper.appendChild(backButton);
};

const revertInput = (input) => {
    input.classList.remove('expanded-input');
    const suggestionsDiv = document.getElementById(`${input.id}Suggestions`);
    if (suggestionsDiv) {
        suggestionsDiv.classList.remove('expanded-suggestions');
    }
    const backButton = input.parentElement.querySelector('.back-button');
    if (backButton) {
        backButton.remove();
    }
};

const inspectDOM = () => {
    const fromInput = document.getElementById('waypoint-input-1');
    const toInput = document.getElementById('waypoint-input-2');
};

const setWaypointInputs = () => {
    const fromInput = document.getElementById('waypoint-input-1');
    const toInput = document.getElementById('waypoint-input-2');

    if (fromInput) {
        const fromWaypoint = appState.waypoints[0];
        if (fromWaypoint) {
            fromInput.value = `${fromWaypoint.city}, (${fromWaypoint.iata_code})`;
        }
    }

    if (toInput) {
        const toWaypoint = appState.waypoints[1];
        if (toWaypoint) {
            toInput.value = `${toWaypoint.city}, (${toWaypoint.iata_code})`;
        }
    }
};

const routeBox = {
    showRouteBox(event, routeNumber) {
        this.removeExistingRouteBox(); // Ensure any existing routeBox is removed
        const routeBoxElement = this.createRouteBox();
        routeBoxElement.dataset.routeNumber = routeNumber; // Add routeNumber as a data attribute
        document.body.appendChild(routeBoxElement); // Append the routeBox to the DOM
        
        if (!appState.routes[routeNumber]) {
            appState.routes[routeNumber] = { tripType: 'oneWay' }; // Default to oneWay if not set
        }
        const topRow = createElement('div', { id: 'topRow', className: 'top-row' });
        topRow.append(tripTypePicker(routeNumber), travelersPicker(routeNumber));
        routeBoxElement.append(topRow);
        
        const waypointInputsContainer = createElement('div', { className: 'waypoint-inputs-container' });
        let firstEmptyInput = null;
        ['From', 'Where to?'].forEach((placeholder, i) => {
            const index = routeNumber * 2 + i;
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
        buttonContainer.append(this.createSearchButton(routeNumber), this.createCloseButton(routeBoxElement, routeNumber));
        removeRouteButton(buttonContainer, routeNumber); // Assuming this is where the remove button is added
        routeBoxElement.append(buttonContainer);
        
        // Position the popup correctly before making it visible
        this.positionPopup(routeBoxElement, event, routeNumber);
        routeBoxElement.style.display = 'block';
        
        [`waypoint-input-${routeNumber * 2 + 1}`, `waypoint-input-${routeNumber * 2 + 2}`].forEach(id => setupAutocompleteForField(id));
        if (firstEmptyInput) {
            firstEmptyInput.focus();
            if (window.innerWidth <= 600) {
                expandInput(firstEmptyInput);
            }
        }

        setupWaypointInputListeners(routeNumber);
        handleTripTypeChange(appState.routes[routeNumber].tripType, routeNumber);
        setTimeout(inspectDOM, 100); // Use a timeout to ensure elements are rendered
        setTimeout(setWaypointInputs, 200); // Use a slightly longer timeout to ensure inputs are rendered
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
            if (appState.currentView !== 'routeTable') {
                updateState('currentView', 'routeTable', 'routeBox.createSearchButton');
            }
            buildRouteTable(routeNumber);
    
            // Hide the routeBox
            const routeBoxElement = document.getElementById('routeBox');
            if (routeBoxElement) {
                routeBoxElement.style.display = 'none';
            }
    
            // Adjust the height of infoPane
            const infoPaneElement = document.getElementById('infoPane');
            if (infoPaneElement) {
                const viewHeight = window.innerHeight;
                const infoPaneHeight = infoPaneElement.offsetHeight;
                if (infoPaneHeight < (0.5 * viewHeight)) {
                    infoPaneElement.style.height = `${0.5 * viewHeight}px`;
                }
            }
        };
        return searchButton;
    },

    createCloseButton(routeBoxElement, routeNumber) {
        const closeButton = createElement('span', { className: 'popup-close-button' });
        closeButton.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 8L12 16L20 8" stroke="#666" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`;
        closeButton.onclick = () => {
            const fromInput = document.querySelector('.from-input input');
            const toInput = document.querySelector('.to-input input');
            if (!fromInput.value.trim() && !toInput.value.trim()) {
                removeRoute(routeNumber);
            }
            routeBoxElement.style.display = 'none';
        };
        return closeButton;
    },

    positionPopup(popup, event, routeNumber) {
        const rect = event.target.getBoundingClientRect();
        const screenPadding = 10;
        const menuBar = document.getElementById('menu-bar');
        const menuBarRect = menuBar.getBoundingClientRect();
        const menuBarTop = menuBarRect.top + window.scrollY;
    
        // Calculate the left position based on routeNumber
        let left = 90 * routeNumber;
    
        // Ensure the left position doesn't go off-screen
        left = Math.min(Math.max(left, screenPadding), window.innerWidth - popup.offsetWidth - screenPadding);
        popup.style.left = `${left}px`;
    
        // Position the popup just above the menu-bar
        let top = menuBarTop - popup.offsetHeight - 55; // 10px offset above the menu-bar
        top = Math.max(top, screenPadding); // Ensure it doesn't go off-screen at the top
        popup.style.top = `${top}px`;
    },

    handleSwapButtonClick(routeNumber) {
        const inputs = document.querySelectorAll('.waypoint-inputs-container input[type="text"]');
        if (inputs.length === 2) {
            [inputs[0].value, inputs[1].value] = [inputs[1].value, inputs[0].value];
            const idx = routeNumber * 2;
            [appState.waypoints[idx], appState.waypoints[idx + 1]] = [appState.waypoints[idx + 1], appState.waypoints[idx]];
            if (appState.waypoints[idx] && appState.waypoints[idx + 1]) {
                routeHandling.updateRoutesArray(); // Only update routes when both waypoints are valid
            }
            updateUrl();
        }
    },
};

document.addEventListener('click', (event) => {
    const routeBox = document.getElementById('routeBox');
    if (routeBox && !routeBox.contains(event.target) &&
        !event.target.closest('.do-not-close-routebox')) {
        const routeNumber = parseInt(routeBox.dataset.routeNumber);
        const fromInput = document.querySelector('.from-input input');
        const toInput = document.querySelector('.to-input input');
        if (!fromInput.value.trim() && !toInput.value.trim()) {
            removeRoute(routeNumber);
        }
        routeBox.style.display = 'none';
    }
}, true);

export { routeBox };

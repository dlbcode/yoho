import { appState, updateState, updateUrl } from '../stateManager.js';
import { setupAutocompleteForField } from '../airportAutocomplete.js';
import { buildRouteDeck } from '../routeDeck/routeDeck.js';
import { adjustMapSize } from '../map.js';
import { travelersPicker } from './travelersPicker.js';
import { tripTypePicker, handleTripTypeChange } from './tripTypePicker.js';
import { removeRoute, removeRouteButton } from './removeRoute.js';
import { routeHandling } from '../routeHandling.js';
import { setupRouteContent } from '../infoPane.js';

const loadCSS = (href) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
};
['css/routeBox.css', 'css/datePicker.css'].forEach(loadCSS);

const createElement = (tag, { id, className, content } = {}) => {
    const element = document.createElement(tag);
    if (id) element.id = id;
    if (className) element.className = className;
    if (content) element.innerHTML = content;
    return element;
};

// Modify createWaypointInput to return elements separately so that the suggestions div
// can be appended directly to the waypoint-inputs-container.
const createWaypointInput = (index, placeholder, waypoint) => {
    const inputWrapper = createElement('div', { className: 'input-wrapper' });
    const input = createElement('input', { 
        id: `waypoint-input-${index + 1}`, 
        className: 'waypoint-input', 
        value: waypoint ? `${waypoint.city}, (${waypoint.iata_code})` : '', 
        placeholder: placeholder // Add this line to set the placeholder
    });
    input.type = 'text';
    inputWrapper.appendChild(input);
    return { inputWrapper, input };
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
            if (window.innerWidth <= 600) expandInput(event.target);
            setTimeout(() => event.target.select(), 0);
        });
        input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                // Using ternary: focus next input if i===0, otherwise blur this input
                i === 0 
                    ? document.querySelector(`#waypoint-input-${routeNumber * 2 + 2}`)?.focus()
                    : input.blur();
            }
        });
        input.addEventListener('blur', async (event) => {
            if (window.innerWidth <= 600) revertInput(event.target);
            const fromInput = document.querySelector(`#waypoint-input-${routeNumber * 2 + 1}`);
            const toInput = document.querySelector(`#waypoint-input-${routeNumber * 2 + 2}`);
            if (input.value === '' && fromInput.value !== '' && toInput.value !== '' && appState.waypoints.length > 0) {
                const waypointIndex = parseInt(input.id.replace('waypoint-input-', '')) - 1;
                if (waypointIndex >= 0 && waypointIndex < appState.waypoints.length && appState.waypoints[waypointIndex].iata_code !== '') {
                    updateState('removeWaypoint', waypointIndex, 'routeBox.setupWaypointInputListeners');
                    routeHandling.updateRoutesArray();
                }
            }
        });
    });
    enableSwapButtonIfNeeded();
};

const expandInput = (input) => {
    input.classList.add('expanded-input');
    const suggestionsDiv = document.getElementById(`${input.id}Suggestions`);
    if (suggestionsDiv) suggestionsDiv.classList.add('expanded-suggestions');

    // Create and add overlay as a child of route-box
    const routeBox = document.querySelector('.route-box');
    const overlay = document.createElement('div');
    overlay.className = 'route-box-overlay';
    routeBox.appendChild(overlay);
    
    // Trigger reflow then add active class for transition
    overlay.offsetHeight;
    overlay.classList.add('active');

    const inputWrapper = input.parentElement;
    const backButton = createElement('button', { className: 'back-button', content: `
        <svg viewBox="0 0 24 24">
            <line x1="22" y1="12" x2="4" y2="12" />
            <line x1="12" y1="3" x2="3" y2="12" />
            <line x1="12" y1="21" x2="3" y2="12" />
        </svg>
    `});
    backButton.onclick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        input.value = '';
        // Remove overlay when back button is clicked
        overlay.classList.remove('active');
        setTimeout(() => overlay.remove(), 200);
        updateState('removeWaypoint', parseInt(input.id.replace('waypoint-input-', '')) - 1, 'routeBox.expandInput');
        routeHandling.updateRoutesArray();
        input.blur();
    };
    inputWrapper.appendChild(backButton);
};

const revertInput = (input) => {
    input.classList.remove('expanded-input');
    const suggestionsDiv = document.getElementById(`${input.id}Suggestions`);
    if (suggestionsDiv) suggestionsDiv.classList.remove('expanded-suggestions');
    const backButton = input.parentElement.querySelector('.back-button');
    if (backButton) backButton.remove();
    
    // Remove overlay with fade out animation
    const overlay = document.querySelector('.route-box-overlay');
    if (overlay) {
        overlay.classList.remove('active');
        setTimeout(() => overlay.remove(), 200);
    }
};

const setWaypointInputs = (routeNumber) => {
    const fromInput = document.getElementById(`waypoint-input-${routeNumber * 2 + 1}`);
    const toInput = document.getElementById(`waypoint-input-${routeNumber * 2 + 2}`);
    const fromWaypoint = appState.waypoints[routeNumber * 2];
    const toWaypoint = appState.waypoints[routeNumber * 2 + 1];

    console.log('Setting waypoint inputs:', { fromWaypoint, toWaypoint });

    if (fromInput) {
        fromInput.value = fromWaypoint ? `${fromWaypoint.city}, (${fromWaypoint.iata_code})` : '';
    }
    if (toInput) {
        toInput.value = toWaypoint ? `${toWaypoint.city}, (${toWaypoint.iata_code})` : '';
    }
};

const routeBox = {
    showRouteBox(event, routeNumber) {
        const { routeBoxElement } = setupRouteContent(routeNumber);
        return routeBoxElement;
    },

    setupRouteBox(routeBoxElement, routeNumber) {
        if (!appState.routes[routeNumber]) {
            appState.routes[routeNumber] = { tripType: 'oneWay' };
        }

        const container = createElement('div', { className: 'topRow' });
        const infoPane = document.getElementById('infoPane');

        const optionsContainer = createElement('div', { className: 'options-container' });
        optionsContainer.append(tripTypePicker(routeNumber), travelersPicker(routeNumber));
        container.append(optionsContainer);

        const waypointInputsContainer = createElement('div', { className: 'waypoint-inputs-container' });
        let firstEmptyInput = null;
        
        // Add explicit placeholders for each input
        const placeholders = ['From', 'Where to?'];
        placeholders.forEach((placeholder, i) => {
            const index = routeNumber * 2 + i;
            const { inputWrapper, input } = createWaypointInput(index, placeholder, appState.waypoints[index]);
            input.placeholder = placeholder; // Explicitly set the placeholder
            inputWrapper.classList.add(i === 0 ? 'from-input' : 'to-input');
            waypointInputsContainer.append(inputWrapper);
            
            // Append suggestions div to the input wrapper for proper positioning
            const suggestionsDiv = routeBox.createSuggestionsDiv(index);
            inputWrapper.append(suggestionsDiv);
            
            if (!firstEmptyInput && !appState.waypoints[index]) {
                firstEmptyInput = input;
            }
        });
        waypointInputsContainer.insertBefore(this.createSwapButton(routeNumber), waypointInputsContainer.children[1]);
        container.append(waypointInputsContainer);

        const dateInputsContainer = createElement('div', { className: 'date-inputs-container' });
        container.append(dateInputsContainer);

        const buttonContainer = createElement('div', { className: 'button-container' });
        
        // Clean up previous search button if it exists
        const existingButton = buttonContainer.querySelector('.search-button');
        if (existingButton?.cleanup) {
            existingButton.cleanup();
        }
        
        buttonContainer.append(this.createSearchButton(routeNumber));
        removeRouteButton(buttonContainer, routeNumber);
        container.append(buttonContainer);

        routeBoxElement.append(container);

        // Update the setupAutocomplete calls to use consistent IDs
        [`waypoint-input-${routeNumber * 2 + 1}`, `waypoint-input-${routeNumber * 2 + 2}`].forEach(id => 
            setupAutocompleteForField(id)
        );

        // Set up listeners first, then focus
        setupWaypointInputListeners(routeNumber);

        // Only focus if not first route box and screen width > 880px
        if (firstEmptyInput && (routeNumber > 0 || window.innerWidth > 600)) {
            firstEmptyInput.focus();
        }

        handleTripTypeChange(appState.routes[routeNumber].tripType, routeNumber);
        setWaypointInputs(routeNumber);
    },

    removeExistingRouteBox() {
        const routeBoxContainer = document.getElementById('routeBoxContainer');
        if (routeBoxContainer) {
            routeBoxContainer.innerHTML = '';
        }
    },

    createRouteBox: function() {
        const routeBoxElement = document.createElement('div');
        routeBoxElement.className = 'route-box';
        return routeBoxElement;
    },

    createSwapButton(routeNumber) {
        const swapButtonContainer = createElement('div', { className: 'swap-button-container' });
        const swapButtonWrapper = createElement('div', { className: 'swap-button-wrapper' });
        const swapButton = createElement('button', { 
            className: 'swap-route-button', 
            content: '&#8646;',
            title: 'Swap waypoints',
            disabled: true 
        });
        swapButton.classList.add('disabled');
        swapButton.onclick = () => this.handleSwapButtonClick(routeNumber);
        
        swapButtonWrapper.appendChild(swapButton);
        swapButtonContainer.appendChild(swapButtonWrapper);
        return swapButtonContainer;
    },

    createSuggestionsDiv(index) {
        const suggestionsDiv = createElement('div', { 
            id: `waypoint-input-${index + 1}Suggestions`, 
            className: 'suggestions' 
        });
        document.getElementById('infoPane').appendChild(suggestionsDiv);
        return suggestionsDiv;
    },

    createSearchButton(routeNumber) {
        const searchButton = createElement('button', { 
            className: 'search-button', 
            content: 'Search'
        });

        // Function to check if route has valid waypoints (either origin OR destination)
        const hasValidWaypoint = () => {
            const fromWaypoint = appState.waypoints[routeNumber * 2];
            const toWaypoint = appState.waypoints[routeNumber * 2 + 1];
            return Boolean(fromWaypoint?.iata_code || toWaypoint?.iata_code);
        };

        // Function to update button state
        const updateButtonState = () => {
            const isEnabled = hasValidWaypoint();
            searchButton.disabled = !isEnabled;
            searchButton.classList.toggle('disabled', !isEnabled);
        };

        // Create a bound listener for this button instance
        const handleStateChange = () => {
            // Use requestAnimationFrame to ensure we get the latest state
            requestAnimationFrame(updateButtonState);
        };

        // Set initial state
        updateButtonState();

        // Add state change listener with explicit check for waypoints
        document.addEventListener('stateChange', (event) => {
            if (event.detail.key === 'waypoints' || 
                event.detail.key === 'addWaypoint' || 
                event.detail.key === 'removeWaypoint' || 
                event.detail.key === 'updateWaypoint') {
                handleStateChange();
            }
        });

        // Clean up listener when button is removed
        searchButton.cleanup = () => {
            document.removeEventListener('stateChange', handleStateChange);
        };

        searchButton.onclick = () => {
            if (!hasValidWaypoint()) return;
            
            const infoPane = document.getElementById('infoPane');
            infoPane.classList.add('search-results');
            
            buildRouteDeck(routeNumber).then(() => {
                const infoPaneElement = document.getElementById('infoPane');
                const viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
                const halfHeight = Math.floor(viewportHeight * 0.5);
                
                requestAnimationFrame(() => {
                    infoPaneElement.style.height = `${halfHeight}px`;
                    infoPaneElement.classList.remove('collapsed');
                    infoPaneElement.classList.add('expanded');
                    adjustMapSize();
                });

                // Ensure the destination waypoint is set to 'Any'
                const toInput = document.getElementById(`waypoint-input-${routeNumber * 2 + 2}`);
                if (toInput && !toInput.value) {
                    toInput.value = 'Any';
                    console.log('Setting destination waypoint to Any');
                }
            });
        };

        return searchButton;
    },

    handleSwapButtonClick(routeNumber) {
        const inputs = document.querySelectorAll('.waypoint-inputs-container input[type="text"]');
        if (inputs.length === 2) {
            [inputs[0].value, inputs[1].value] = [inputs[1].value, inputs[0].value];
            const idx = routeNumber * 2;
            [appState.waypoints[idx], appState.waypoints[idx + 1]] = [appState.waypoints[idx + 1], appState.waypoints[idx]];
            if (appState.waypoints[idx] && appState.waypoints[idx + 1]) routeHandling.updateRoutesArray();
            updateUrl();
        }
    },
};

export { routeBox };
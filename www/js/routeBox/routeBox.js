import { appState, updateState, updateUrl } from '../stateManager.js';
import { setupAutocompleteForField } from '../airportAutocomplete.js';
import { buildRouteDeck } from '../routeDeck/routeDeck.js';
import { adjustMapSize } from '../map.js';
import { travelersPicker } from './travelersPicker.js';
import { tripTypePicker, handleTripTypeChange } from './tripTypePicker.js';
import { removeRoute, removeRouteButton } from './removeRoute.js';
import { routeHandling } from '../routeHandling.js';
import { setupRouteContent } from '../infoPane.js';
import { inputManager } from '../inputManager.js';

// Simplified debounce function
const debounce = (func, wait) => {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
};

// Load required CSS files
['css/routeBox.css', 'css/datePicker.css'].forEach(href => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
});

// Simplified element creation utility
const createElement = (tag, { id, className, content } = {}) => {
    const element = document.createElement(tag);
    if (id) element.id = id;
    if (className) element.className = className;
    if (content) element.innerHTML = content;
    return element;
};

// Consolidated waypoint input creation
const createWaypointInput = (index, placeholder, waypoint) => {
    const inputWrapper = createElement('div', { className: 'input-wrapper' });
    const input = createElement('input', { 
        id: `waypoint-input-${index + 1}`, 
        className: 'waypoint-input', 
        value: waypoint ? `${waypoint.city}, (${waypoint.iata_code})` : '',
        placeholder
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

const setWaypointInputs = (routeNumber) => {
    // Let inputManager handle syncing waypoint inputs
    [`waypoint-input-${routeNumber * 2 + 1}`, `waypoint-input-${routeNumber * 2 + 2}`].forEach(
        inputId => inputManager.syncInputWithWaypoint(inputId)
    );
    enableSwapButtonIfNeeded();
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

        const container = createElement('div', { className: 'routeBoxElements' });

        // Add options container (trip type & travelers)
        const optionsContainer = createElement('div', { className: 'options-container' });
        optionsContainer.append(tripTypePicker(routeNumber), travelersPicker(routeNumber));
        container.append(optionsContainer);

        // Add waypoint inputs container
        const waypointInputsContainer = createElement('div', { className: 'waypoint-inputs-container' });
        let firstEmptyInput = null;
        
        // Add waypoint inputs with placeholders
        ['From', 'Where to?'].forEach((placeholder, i) => {
            const index = routeNumber * 2 + i;
            const { inputWrapper, input } = createWaypointInput(index, placeholder, appState.waypoints[index]);
            inputWrapper.classList.add(i === 0 ? 'from-input' : 'to-input');
            waypointInputsContainer.append(inputWrapper);
            
            // Create suggestions div
            createElement('div', { 
                id: `waypoint-input-${index + 1}Suggestions`, 
                className: 'suggestions' 
            });
            
            if (!firstEmptyInput && !appState.waypoints[index]) {
                firstEmptyInput = input;
            }
            
            input.addEventListener('input', enableSwapButtonIfNeeded);
        });
        
        // Add swap button between inputs
        waypointInputsContainer.insertBefore(this.createSwapButton(routeNumber), waypointInputsContainer.children[1]);
        container.append(waypointInputsContainer);

        // Add date inputs container
        container.append(createElement('div', { className: 'date-inputs-container' }));

        // Add button container with search and remove buttons
        const buttonContainer = createElement('div', { className: 'button-container' });
        const existingButton = buttonContainer.querySelector('.search-button');
        if (existingButton?.cleanup) existingButton.cleanup();
        
        buttonContainer.append(this.createSearchButton(routeNumber));
        removeRouteButton(buttonContainer, routeNumber);
        container.append(buttonContainer);

        routeBoxElement.append(container);

        // Setup autocomplete for waypoint inputs
        const inputIds = [`waypoint-input-${routeNumber * 2 + 1}`, `waypoint-input-${routeNumber * 2 + 2}`];
        inputIds.forEach(id => setupAutocompleteForField(id));
        
        // Position suggestion boxes after a short delay to ensure DOM is fully rendered
        setTimeout(() => {
            inputIds.forEach(id => {
                if (inputManager.suggestionBoxes[id]) {
                    inputManager.positionSuggestionBox(id);
                }
            });
        }, 50);

        setWaypointInputs(routeNumber);

        // Focus first empty input if appropriate
        if (firstEmptyInput && (routeNumber > 0 || window.innerWidth > 600)) {
            firstEmptyInput.focus();
        }

        handleTripTypeChange(appState.routes[routeNumber].tripType, routeNumber);
    },

    removeExistingRouteBox() {
        const routeBoxContainer = document.getElementById('routeBoxContainer');
        if (routeBoxContainer) routeBoxContainer.innerHTML = '';
    },

    createRouteBox() {
        return createElement('div', { className: 'route-box' });
    },

    createSwapButton(routeNumber) {
        const swapButtonContainer = createElement('div', { className: 'swap-button-container' });
        const swapButtonWrapper = createElement('div', { className: 'swap-button-wrapper' });
        const swapButton = createElement('button', { 
            className: 'swap-route-button disabled', 
            content: '&#8646;',
            title: 'Swap waypoints'
        });
        swapButton.disabled = true;
        swapButton.onclick = () => this.handleSwapButtonClick(routeNumber);
        
        swapButtonWrapper.appendChild(swapButton);
        swapButtonContainer.appendChild(swapButtonWrapper);
        return swapButtonContainer;
    },

    createSearchButton(routeNumber) {
        const searchButton = createElement('button', { 
            className: 'search-button', 
            content: 'Search'
        });

        // Check if route has valid waypoints
        const hasValidWaypoint = () => {
            const fromWaypoint = appState.waypoints[routeNumber * 2];
            const toWaypoint = appState.waypoints[routeNumber * 2 + 1];
            return Boolean(fromWaypoint?.iata_code || toWaypoint?.iata_code);
        };

        const updateButtonState = () => {
            const isEnabled = hasValidWaypoint();
            searchButton.disabled = !isEnabled;
            searchButton.classList.toggle('disabled', !isEnabled);
        };

        const handleStateChange = () => requestAnimationFrame(updateButtonState);

        updateButtonState();

        // Add state change listener for relevant waypoint changes
        const stateChangeHandler = (event) => {
            if (['waypoints', 'addWaypoint', 'removeWaypoint', 'updateWaypoint'].includes(event.detail.key)) {
                handleStateChange();
            }
        };
        document.addEventListener('stateChange', stateChangeHandler);

        searchButton.cleanup = () => document.removeEventListener('stateChange', stateChangeHandler);

        searchButton.onclick = () => {
            if (!hasValidWaypoint()) return;
            
            const infoPane = document.getElementById('infoPane');
            infoPane.classList.add('search-results');
            appState.searchResultsLoading = true;
            
            buildRouteDeck(routeNumber).then(() => {
                const infoPaneElement = document.getElementById('infoPane');
                const viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
                const halfHeight = Math.floor(viewportHeight * 0.5);
                
                requestAnimationFrame(() => {
                    infoPaneElement.style.height = `${halfHeight}px`;
                    infoPaneElement.classList.remove('collapsed');
                    infoPaneElement.classList.add('expanded');
                    adjustMapSize();
                    setTimeout(() => appState.searchResultsLoading = false, 500);
                });

                // Set destination to 'Any' if empty
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
            // Store data before swapping
            const inputId1 = inputs[0].id;
            const inputId2 = inputs[1].id;
            const value1 = inputs[0].value;
            const value2 = inputs[1].value;
            const iata1 = inputs[0].getAttribute('data-selected-iata');
            const iata2 = inputs[1].getAttribute('data-selected-iata');
            const isAny1 = inputs[0].getAttribute('data-is-any-destination') === 'true';
            const isAny2 = inputs[1].getAttribute('data-is-any-destination') === 'true';

            // Swap values
            inputs[0].value = value2;
            inputs[1].value = value1;
            
            // Swap IATA codes
            inputs[0].setAttribute('data-selected-iata', iata2 || '');
            inputs[1].setAttribute('data-selected-iata', iata1 || '');
            if (!iata2) inputs[0].removeAttribute('data-selected-iata');
            if (!iata1) inputs[1].removeAttribute('data-selected-iata');
            
            // Swap "any destination" attributes
            isAny1 ? inputs[1].setAttribute('data-is-any-destination', 'true') : 
                    inputs[1].removeAttribute('data-is-any-destination');
            isAny2 ? inputs[0].setAttribute('data-is-any-destination', 'true') : 
                    inputs[0].removeAttribute('data-is-any-destination');
            
            // Update input manager states
            if (inputManager.inputStates[inputId1]) {
                inputManager.inputStates[inputId1].previousValidValue = value2;
                inputManager.inputStates[inputId1].previousIataCode = iata2;
            }
            
            if (inputManager.inputStates[inputId2]) {
                inputManager.inputStates[inputId2].previousValidValue = value1;
                inputManager.inputStates[inputId2].previousIataCode = iata1;
            }
            
            // Update appState waypoints
            const idx = routeNumber * 2;
            [appState.waypoints[idx], appState.waypoints[idx + 1]] = 
                [appState.waypoints[idx + 1], appState.waypoints[idx]];
            
            if (appState.waypoints[idx] && appState.waypoints[idx + 1]) {
                routeHandling.updateRoutesArray();
            }
            updateUrl();
        }
    },
};

// Simplified mobile overlay functions
const createMobileOverlay = () => inputManager.createMobileOverlay();
const cleanupOverlays = () => inputManager.cleanup();

document.addEventListener('DOMContentLoaded', () => {
    cleanupOverlays();
    
    // Listen for route boxes being added to reposition suggestion boxes
    const observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                mutation.addedNodes.forEach(node => {
                    if (node.classList && node.classList.contains('route-box')) {
                        // Position all suggestion boxes after a route box is added
                        setTimeout(() => {
                            Object.keys(inputManager.suggestionBoxes).forEach(id => {
                                inputManager.positionSuggestionBox(id);
                            });
                        }, 100);
                    }
                });
            }
        });
    });
    
    const container = document.getElementById('routeBoxContainer');
    if (container) {
        observer.observe(container, { childList: true, subtree: true });
    }
});

export { routeBox };
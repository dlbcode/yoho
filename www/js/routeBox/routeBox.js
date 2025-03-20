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

// Simplified debounce function - reuse inputManager's debounce for consistency
const debounce = (func, wait) => inputManager.debounce(func, wait);

// Load required CSS files - consolidate into a single function
const loadStyles = (urls) => urls.forEach(href => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
});

loadStyles(['css/routeBox.css', 'css/datePicker.css']);

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
        value: waypoint ? `${waypoint.city}, (${waypoint.iata_code})` : ''
    });
    input.type = 'text';
    input.placeholder = placeholder;
    input.readOnly = Boolean(waypoint);
    inputWrapper.appendChild(input);
    return { inputWrapper, input };
};

const enableSwapButtonIfNeeded = () => {
    const fromInput = document.querySelector('.from-input input');
    const toInput = document.querySelector('.to-input input');
    const swapButton = document.querySelector('.swap-route-button');
    if (!swapButton) return;
    
    const isEnabled = fromInput && toInput && fromInput.value.trim() && toInput.value.trim();
    swapButton.disabled = !isEnabled;
    swapButton.classList.toggle('disabled', !isEnabled);
};

const setWaypointInputs = (routeNumber) => {
    // Let inputManager handle syncing waypoint inputs with more careful logging
    const inputIds = [`waypoint-input-${routeNumber * 2 + 1}`, `waypoint-input-${routeNumber * 2 + 2}`];
    
    inputIds.forEach(inputId => {
        const waypointIndex = parseInt(inputId.replace(/\D/g, ''), 10) - 1;
        const waypoint = appState.waypoints[waypointIndex];
        
        console.log(`Syncing input ${inputId} with waypoint:`, waypoint);
        inputManager.syncInputWithWaypoint(inputId);
        
        // Double-check the result
        const inputField = document.getElementById(inputId);
        if (inputField && waypoint && waypoint.iata_code !== 'Any' && inputField.value === 'Anywhere') {
            console.error(`Incorrect sync for ${inputId}. Got 'Anywhere' but expected airport:`, waypoint);
            // Force correct value as a fallback
            inputField.value = `${waypoint.city}, (${waypoint.iata_code})`;
            inputField.setAttribute('data-selected-iata', waypoint.iata_code);
            inputField.removeAttribute('data-is-any-destination');
        }
    });
    
    enableSwapButtonIfNeeded();
}

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
        
        // Position suggestion boxes - use requestAnimationFrame for better performance
        requestAnimationFrame(() => {
            inputIds.forEach(id => {
                if (inputManager.suggestionBoxes[id]) {
                    inputManager.positionSuggestionBox(id);
                }
            });
        });

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

        // Check if route has valid waypoints - simplify validation
        const hasValidWaypoint = () => {
            const fromIndex = routeNumber * 2;
            const toIndex = fromIndex + 1;
            
            // If only destination is set, ensure we report valid
            if (!appState.waypoints[fromIndex] && appState.waypoints[toIndex]) {
                return true;
            }
            
            return Boolean(
                appState.waypoints[fromIndex]?.iata_code || 
                appState.waypoints[toIndex]?.iata_code
            );
        };

        const updateButtonState = () => {
            const isEnabled = hasValidWaypoint();
            searchButton.disabled = !isEnabled;
            searchButton.classList.toggle('disabled', !isEnabled);
        };

        updateButtonState();

        // Add state change listener for relevant waypoint changes - use event delegation
        const stateChangeHandler = (event) => {
            if (['waypoints', 'addWaypoint', 'removeWaypoint', 'updateWaypoint'].includes(event.detail.key)) {
                requestAnimationFrame(updateButtonState);
            }
        };
        document.addEventListener('stateChange', stateChangeHandler);

        searchButton.cleanup = () => document.removeEventListener('stateChange', stateChangeHandler);

        searchButton.onclick = () => {
            if (!hasValidWaypoint()) return;
            
            const fromIndex = routeNumber * 2;
            const toIndex = fromIndex + 1;
            
            // If destination set but no origin, create "Any" origin
            if (!appState.waypoints[fromIndex] && appState.waypoints[toIndex]) {
                updateState('fixWaypointOrder', {origin: fromIndex, destination: toIndex}, 'routeBox.searchButton');
            }
            
            const infoPane = document.getElementById('infoPane');
            infoPane.classList.add('search-results');
            appState.searchResultsLoading = true;
            
            // Fix waypoint inconsistencies before building route deck
            if (appState.waypoints[toIndex] && appState.waypoints[toIndex].iata_code !== 'Any') {
                // Ensure isAnyDestination is false for valid IATA destinations
                appState.waypoints[toIndex].isAnyDestination = false;
            }
            
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

                // Set destination to 'Any' if empty - optimize conditional
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
        if (inputs.length !== 2) return;
        
        // Get all data upfront
        const [input1, input2] = inputs;
        const inputId1 = input1.id;
        const inputId2 = input2.id;
        const attr1 = {
            value: input1.value,
            iata: input1.getAttribute('data-selected-iata') || '',
            isAny: input1.getAttribute('data-is-any-destination') === 'true'
        };
        const attr2 = {
            value: input2.value,
            iata: input2.getAttribute('data-selected-iata') || '',
            isAny: input2.getAttribute('data-is-any-destination') === 'true'
        };

        // Swap values
        input1.value = attr2.value;
        input2.value = attr1.value;
        
        // Swap IATA codes
        if (attr2.iata) input1.setAttribute('data-selected-iata', attr2.iata);
        else input1.removeAttribute('data-selected-iata');
        
        if (attr1.iata) input2.setAttribute('data-selected-iata', attr1.iata);
        else input2.removeAttribute('data-selected-iata');
        
        // Swap "any destination" attributes
        attr1.isAny ? input2.setAttribute('data-is-any-destination', 'true') : 
                input2.removeAttribute('data-is-any-destination');
        attr2.isAny ? input1.setAttribute('data-is-any-destination', 'true') : 
                input1.removeAttribute('data-is-any-destination');
        
        // Update input manager states
        const updateInputState = (id, value, iata) => {
            if (inputManager.inputStates[id]) {
                inputManager.inputStates[id].previousValidValue = value;
                inputManager.inputStates[id].previousIataCode = iata;
            }
        };
        updateInputState(inputId1, attr2.value, attr2.iata);
        updateInputState(inputId2, attr1.value, attr1.iata);
        
        // Update appState waypoints
        const idx = routeNumber * 2;
        [appState.waypoints[idx], appState.waypoints[idx + 1]] = 
            [appState.waypoints[idx + 1], appState.waypoints[idx]];
        
        if (appState.waypoints[idx] && appState.waypoints[idx + 1]) {
            routeHandling.updateRoutesArray();
        }
        updateUrl();
    },
};

// Use inputManager directly
document.addEventListener('DOMContentLoaded', () => {
    inputManager.cleanup();
    
    // Listen for route boxes being added to reposition suggestion boxes
    const observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                mutation.addedNodes.forEach(node => {
                    if (node.classList && node.classList.contains('route-box')) {
                        requestAnimationFrame(() => {
                            Object.keys(inputManager.suggestionBoxes).forEach(id => {
                                inputManager.positionSuggestionBox(id);
                            });
                        });
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
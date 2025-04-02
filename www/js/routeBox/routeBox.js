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
        value: waypoint ? `${waypoint.city || waypoint.iata_code}, (${waypoint.iata_code})` : ''
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
    // Get input elements
    const inputIds = [`waypoint-input-${routeNumber * 2 + 1}`, `waypoint-input-${routeNumber * 2 + 2}`];
    
    inputIds.forEach((inputId, idx) => {
        const isOrigin = idx === 0;
        const routeData = appState.routeData[routeNumber];
        const waypoint = isOrigin ? routeData?.origin : routeData?.destination;
        
        console.log(`Syncing input ${inputId} with ${isOrigin ? 'origin' : 'destination'} waypoint:`, waypoint);
        
        const inputField = document.getElementById(inputId);
        if (!inputField) return;
        
        if (waypoint) {
            if (waypoint.iata_code === 'Any' || waypoint.isAnyDestination || waypoint.isAnyOrigin) {
                // Handle "Any" waypoint
                inputField.value = 'Anywhere';
                inputField.setAttribute('data-selected-iata', 'Any');
                inputField.setAttribute('data-is-any-destination', 'true');
                inputField.readOnly = true;
                
                if (inputManager.inputStates[inputId]) {
                    inputManager.inputStates[inputId].previousValidValue = 'Anywhere';
                    inputManager.inputStates[inputId].previousIataCode = 'Any';
                }
            } else if (waypoint.iata_code) {
                // Handle normal airport
                const displayValue = `${waypoint.city || waypoint.name || waypoint.iata_code}, (${waypoint.iata_code})`;
                inputField.value = displayValue;
                inputField.setAttribute('data-selected-iata', waypoint.iata_code);
                inputField.removeAttribute('data-is-any-destination');
                inputField.readOnly = true;
                
                if (inputManager.inputStates[inputId]) {
                    inputManager.inputStates[inputId].previousValidValue = displayValue;
                    inputManager.inputStates[inputId].previousIataCode = waypoint.iata_code;
                }
            } else {
                // Handle empty waypoint
                inputField.value = '';
                inputField.readOnly = false;
                inputField.removeAttribute('data-selected-iata');
                inputField.removeAttribute('data-is-any-destination');
            }
        } else {
            // No waypoint exists
            inputField.value = '';
            inputField.readOnly = false;
            inputField.removeAttribute('data-selected-iata');
            inputField.removeAttribute('data-is-any-destination');
        }
    });
    
    enableSwapButtonIfNeeded();
};

const routeBox = {
    showRouteBox(event, routeNumber) {
        const { routeBoxElement } = setupRouteContent(routeNumber);
        return routeBoxElement;
    },

    setupRouteBox(routeBoxElement, routeNumber) {
        // Initialize route data if needed
        if (!appState.routeData[routeNumber]) {
            // Check if there's a selectedRoute with this index first
            const selectedRoute = appState.selectedRoutes[routeNumber];
            if (selectedRoute && selectedRoute.displayData) {
                // Extract route information from the selectedRoute
                const routeParts = selectedRoute.displayData.route.split(' > ');
                if (routeParts.length === 2) {
                    const origin = routeParts[0];
                    const destination = routeParts[1];
                    
                    // Create minimal routeData from the selected route
                    appState.routeData[routeNumber] = {
                        tripType: 'oneWay', // Segments are typically one-way
                        travelers: 1, // Default value
                        departDate: selectedRoute.displayData.departure,
                        returnDate: null,
                        origin: { iata_code: origin },
                        destination: { iata_code: destination },
                        isSegment: true
                    };
                    
                    console.log(`Created routeData for segment ${routeNumber} from selectedRoute:`, appState.routeData[routeNumber]);
                } else {
                    // Default initialization if route format is unexpected
                    appState.routeData[routeNumber] = { 
                        tripType: 'oneWay', 
                        travelers: 1,
                        departDate: new Date().toISOString().split('T')[0],
                        returnDate: null
                    };
                }
            } else {
                // No selectedRoute, use default initialization
                appState.routeData[routeNumber] = { 
                    tripType: 'oneWay', 
                    travelers: 1,
                    departDate: new Date().toISOString().split('T')[0],
                    returnDate: null
                };
            }
        }

        console.log(`Setting up route box for route ${routeNumber} with data:`, appState.routeData[routeNumber]);

        // Get the route data for this route - ensure it's defined before using it
        const routeData = appState.routeData[routeNumber] || {
            tripType: 'oneWay',
            travelers: 1,
            departDate: new Date().toISOString().split('T')[0],
            returnDate: null
        };

        const container = createElement('div', { className: 'routeBoxElements' });

        // Add options container (trip type & travelers)
        const optionsContainer = createElement('div', { className: 'options-container' });
        optionsContainer.append(tripTypePicker(routeNumber), travelersPicker(routeNumber));
        container.append(optionsContainer);

        // Add waypoint inputs container
        const waypointInputsContainer = createElement('div', { className: 'waypoint-inputs-container' });
        
        // Store input elements for later use
        const inputElements = [];
        
        // Add waypoint inputs with placeholders
        ['From', 'Where to?'].forEach((placeholder, i) => {
            const isOrigin = i === 0;
            const waypoint = isOrigin ? routeData?.origin : routeData?.destination;
            
            console.log(`Creating input for ${isOrigin ? 'origin' : 'destination'}:`, waypoint);
            
            const index = routeNumber * 2 + i;
            const { inputWrapper, input } = createWaypointInput(index, placeholder, waypoint);
            inputWrapper.classList.add(isOrigin ? 'from-input' : 'to-input');
            
            // Also add destination-input class to make it easier to select later
            if (!isOrigin) {
                inputWrapper.classList.add('destination-input');
                input.classList.add('destination-input-field');
            }
            
            waypointInputsContainer.append(inputWrapper);
            inputElements.push(input);
            
            // Create suggestions div
            const suggestionsDiv = createElement('div', { 
                id: `waypoint-input-${index + 1}Suggestions`, 
                className: 'suggestions' 
            });
            document.body.appendChild(suggestionsDiv);
            
            // Add a selection handler to immediately update appState when an airport is selected
            input.addEventListener('airport-selected', (event) => {
                if (event.detail && event.detail.airport) {
                    // Update directly in routeData structure
                    if (isOrigin) {
                        appState.routeData[routeNumber].origin = event.detail.airport;
                    } else {
                        appState.routeData[routeNumber].destination = event.detail.airport;
                    }
                    
                    // Notify stateManager of the update, but with a different action
                    // Instead of 'updateWaypoint' which works with legacy indices,
                    // use 'updateRouteData' which works directly with routeData
                    updateState('updateRouteData', {
                        routeNumber: routeNumber,
                        data: appState.routeData[routeNumber]
                    }, 'routeBox.setupRouteBox.airportSelected');
                    
                    // Force update of the input fields to ensure they reflect the latest state
                    setTimeout(() => setWaypointInputs(routeNumber), 0);
                }
            });
            
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

        // Force synchronization of input fields with routeData
        setWaypointInputs(routeNumber);

        // Skip focusing on initial page load for mobile
        const shouldSkipFocus = routeNumber === 0 && window.innerWidth <= 600;
        
        if (!shouldSkipFocus) {
            const routeData = appState.routeData[routeNumber] || {};
            const originAutoPopulated = routeData._originAutoPopulated;
            const destinationNeedsEmptyFocus = routeData._destinationNeedsEmptyFocus;
            
            // Check if we have an origin but no destination
            const hasOrigin = routeData.origin && routeData.origin.iata_code;
            const hasDestination = routeData.destination && routeData.destination.iata_code;
            
            // Initialize destination input for focusing
            const destInput = inputElements[1];
            
            // If we have an origin (either auto-populated or not) but no destination, focus the destination field
            if (hasOrigin && !hasDestination) {
                console.log("Origin present but no destination, focusing destination input");
                // Use a slightly longer timeout to ensure DOM is ready
                setTimeout(() => {
                    if (destInput) {
                        // Check if we should do empty focus (for autocomplete suggestions)
                        if (destinationNeedsEmptyFocus) {
                            destInput.value = '';
                            destInput.readOnly = false;
                            destInput.focus();
                            
                            // Trigger the input event to show the suggestions
                            destInput.dispatchEvent(new Event('input', { bubbles: true }));
                            
                            // Import and trigger suggestions
                            import('../airportAutocomplete.js').then(({ updateSuggestions }) => {
                                updateSuggestions(`waypoint-input-${routeNumber * 2 + 2}`, []);
                            });
                        } else {
                            destInput.focus();
                        }
                        console.log("Destination input focused");
                    }
                }, 150);
            }
            // If neither origin nor destination is set, focus the origin field
            else if (!hasOrigin) {
                setTimeout(() => {
                    const originInput = inputElements[0];
                    if (originInput) {
                        originInput.focus();
                    }
                }, 150);
            }
        }

        handleTripTypeChange(routeData.tripType || 'oneWay', routeNumber);
        
        // This is a special hook for focusing after plus button click
        // It's only used for the immediate action after creating a new route
        if (routeBoxElement._needsFocusOnDestination) {
            setTimeout(() => {
                const destInput = inputElements[1];
                if (destInput) {
                    destInput.focus();
                    console.log("Destination input focused via special hook");
                }
                delete routeBoxElement._needsFocusOnDestination;
            }, 150);
        }
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
        const hasValidWaypoints = () => {
            const routeData = appState.routeData[routeNumber];
            return routeData && (routeData.origin?.iata_code || routeData.destination?.iata_code);
        };

        const updateButtonState = () => {
            const isEnabled = hasValidWaypoints();
            searchButton.disabled = !isEnabled;
            searchButton.classList.toggle('disabled', !isEnabled);
        };

        updateButtonState();

        // Add state change listener for relevant waypoint changes
        const stateChangeHandler = (event) => {
            if (['updateWaypoint', 'addWaypoint', 'removeWaypoint'].includes(event.detail.key)) {
                requestAnimationFrame(updateButtonState);
            }
        };
        document.addEventListener('stateChange', stateChangeHandler);

        searchButton.cleanup = () => document.removeEventListener('stateChange', stateChangeHandler);

        searchButton.onclick = () => {
            if (!hasValidWaypoints()) return;
            
            const routeData = appState.routeData[routeNumber];
            
            // If destination set but no origin, create "Any" origin
            if (!routeData.origin && routeData.destination) {
                const anyOrigin = {
                    iata_code: 'Any',
                    name: 'Any Origin',
                    city: 'Anywhere',
                    isAnyOrigin: true,
                    isAnyDestination: false
                };
                
                // Update directly in routeData and use updateRouteData instead of updateWaypoint
                routeData.origin = anyOrigin;
                updateState('updateRouteData', { 
                    routeNumber, 
                    data: { origin: anyOrigin }
                }, 'routeBox.searchButton');
            }
            
            const infoPane = document.getElementById('infoPane');
            infoPane.classList.add('search-results');
            appState.searchResultsLoading = true;
            
            // Ensure destination isAnyDestination flag is correct before building route deck
            if (routeData.destination && routeData.destination.iata_code !== 'Any') {
                routeData.destination.isAnyDestination = false;
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

                // Set destination to 'Any' if empty
                if (!routeData.destination) {
                    const anyDestination = {
                        iata_code: 'Any',
                        name: 'Any Destination',
                        city: 'Anywhere',
                        isAnyDestination: true,
                        isAnyOrigin: false
                    };
                    
                    // Update directly in routeData and use updateRouteData instead of updateWaypoint
                    routeData.destination = anyDestination;
                    updateState('updateRouteData', { 
                        routeNumber, 
                        data: { destination: anyDestination }
                    }, 'routeBox.searchButton.anyDestination');
                }
            });
        };

        return searchButton;
    },

    handleSwapButtonClick(routeNumber) {
        const routeData = appState.routeData[routeNumber];
        if (!routeData) return;
        
        // Swap origin and destination in routeData
        const tempOrigin = routeData.origin;
        routeData.origin = routeData.destination;
        routeData.destination = tempOrigin;
        
        // Update inputs to reflect the new state
        setWaypointInputs(routeNumber);
        
        // Update state directly with the updated routeData
        updateState('updateRouteData', { 
            routeNumber, 
            data: routeData 
        }, 'routeBox.swapButton');
        
        // Update routes if we have valid waypoints
        if (routeData.origin?.iata_code && routeData.destination?.iata_code) {
            // Always use routeData directly - simplify this code
            requestAnimationFrame(() => {
                // Import necessary modules when needed to avoid circular dependencies
                import('../routeHandling.js').then(({ routeHandling }) => {
                    // Use updateRoutesArray which now contains the modern implementation
                    routeHandling.updateRoutesArray();
                });
            });
        }
        
        // Update URL with the latest route information
        updateUrl();
    },
    
    // Add a utility method to work directly with routeData
    getRouteDataForRoute(routeNumber) {
        // Ensure routeData exists for this route
        if (!appState.routeData[routeNumber]) {
            appState.routeData[routeNumber] = {
                tripType: 'oneWay',
                travelers: 1,
                departDate: new Date().toISOString().split('T')[0],
                returnDate: null
            };
        }
        return appState.routeData[routeNumber];
    }
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
import { appState, updateState } from './stateManager.js';
import { map } from './map.js';
import { fetchAirportByIata, updateSuggestions } from './airportAutocomplete.js';

class InputManager {
    constructor() {
        this.debounceTimers = {};
        this.suggestionBoxes = {};
        this.inputStates = {};
        this.resizeObservers = [];
    }

    debounce(func, delay, id) {
        const timerId = id || Math.random().toString(36);
        return (...args) => {
            clearTimeout(this.debounceTimers[timerId]);
            this.debounceTimers[timerId] = setTimeout(() => func(...args), delay);
            return timerId;
        };
    }

    initInputState(inputId) {
        if (!this.inputStates[inputId]) {
            this.inputStates[inputId] = {
                isInitialFocus: true,
                isExpanded: false,
                isProcessingBlur: false,
                hasSuggestions: false,
                selectedIata: null,
                isAnyDestination: false,
                selectedSuggestionIndex: -1,
                previousValidValue: '',
                previousIataCode: null,
            };
        }
        return this.inputStates[inputId];
    }

    setupWaypointInput(inputId, options = {}) {
        const inputField = document.getElementById(inputId);
        if (!inputField) return null;

        const routeNumber = parseInt(inputId.replace(/\D/g, ''), 10) - 1;
        const waypointIndex = routeNumber;
        const isOriginField = waypointIndex % 2 === 0;
        const inputState = this.initInputState(inputId);
        
        this.cleanupInputListeners(inputId);
        
        // Store the original placeholder
        const originalPlaceholder = inputField.getAttribute('placeholder') || 
            (isOriginField ? 'From' : 'Where to?');
        
        // Set necessary attributes
        inputField.setAttribute('autocomplete', 'new-password');
        inputField.setAttribute('name', `waypoint-input-${Date.now()}`);
        inputField.setAttribute('role', 'combobox');
        inputField.setAttribute('aria-autocomplete', 'list');
        inputField.setAttribute('aria-expanded', 'false');
        
        // Set placeholder once - the CSS will handle visibility
        if (originalPlaceholder) {
            inputField.placeholder = originalPlaceholder;
        }
        
        const suggestionBox = this.ensureSuggestionBox(inputId);
        
        const handlers = {
            focus: this.handleFocus.bind(this, inputId),
            blur: this.handleBlur.bind(this, inputId),
            input: this.debounce(this.handleInput.bind(this, inputId), 200, `input-${inputId}`),
            keydown: this.handleKeyDown.bind(this, inputId)
        };
        
        Object.entries(handlers).forEach(([event, handler]) => {
            inputField.addEventListener(event, handler);
        });
        
        inputState.handlers = handlers;
        this.syncInputWithWaypoint(inputId);
        
        // Add a custom event listener for airport selection
        inputField.addEventListener('airportSelected', (event) => {
            console.log(`airportSelected event received on ${inputId}`, event.detail);
            this.handleAirportSelection(inputId, event.detail.airport);
        });
        
        return inputField;
    }
    
    ensureSuggestionBox(inputId) {
        let suggestionBox = document.getElementById(`${inputId}Suggestions`);
        
        if (suggestionBox) suggestionBox.remove();
        
        suggestionBox = document.createElement('div');
        suggestionBox.id = `${inputId}Suggestions`;
        suggestionBox.className = 'suggestions';
        suggestionBox.setAttribute('role', 'listbox');
        
        document.body.appendChild(suggestionBox);
        this.suggestionBoxes[inputId] = suggestionBox;
        
        return suggestionBox;
    }
    
    cleanupInputListeners(inputId) {
        const inputField = document.getElementById(inputId);
        const inputState = this.inputStates[inputId];
        
        if (inputField && inputState?.handlers) {
            Object.entries(inputState.handlers).forEach(([event, handler]) => {
                inputField.removeEventListener(event, handler);
            });
        }
    }
    
    handleFocus(inputId, event) {
        const inputField = document.getElementById(inputId);
        const inputState = this.inputStates[inputId];
        const suggestionBox = this.suggestionBoxes[inputId];     
        if (!inputField || !inputState) return;
        
        // Save previous value
        inputState.previousValidValue = inputField.value;
        inputState.previousIataCode = inputField.getAttribute('data-selected-iata');
        
        // Always remove readonly on focus
        inputField.removeAttribute('readonly');
        
        if (this.isMobile()) {
            if (!inputState.isExpanded) {
                this.createMobileOverlay();
                this.expandInput(inputId);
                inputState.isExpanded = true;
            }
        } else if (suggestionBox) {
            // Always position the suggestion box on focus, even if empty
            this.positionSuggestionBox(inputId);
            
            // Only show if it has content
            if (suggestionBox.children.length > 0) {
                suggestionBox.style.display = 'block';
            }
        }
        
        requestAnimationFrame(() => inputField.select());
        
        // Add touchstart event to suggestion box for better mobile interaction
        if (suggestionBox && this.isMobile()) {
            if (!suggestionBox._hasTouchListener) {
                suggestionBox.addEventListener('touchstart', (e) => {
                    // Prevent default to avoid additional events
                    if (e.target !== suggestionBox) {
                        e.preventDefault();
                    }
                }, { passive: false });
                suggestionBox._hasTouchListener = true;
            }
        }
        
        const iataCode = inputField.getAttribute('data-selected-iata');
        if (iataCode && iataCode !== 'Any') {
            fetchAirportByIata(iataCode)
                .then(airport => {
                    if (!appState.preventMapViewChange && airport?.latitude && airport?.longitude) {
                        map.flyTo([airport.latitude, airport.longitude], 6, { animate: true, duration: 0.5 });
                    }
                })
                .catch(error => console.warn('Error flying to airport:', error));
        }

        // Always show empty suggestions on focus if field is empty
        if (!inputField.value.trim()) {
            // Important: This needs to handle the special case of destination-after-origin focus
            const waypointIndex = parseInt(inputId.replace(/\D/g, ''), 10) - 1;
            const routeNumber = Math.floor(waypointIndex / 2);
            const isOrigin = waypointIndex % 2 === 0;
            
            // If we're a destination field and the corresponding origin is set
            if (!isOrigin && appState.routeData[routeNumber]?.origin) {
                // Mark that we need suggestions (this is used in updateSuggestions)
                appState.routeData[routeNumber]._destinationNeedsEmptyFocus = true;
            }
            
            updateSuggestions(inputId, []);
            this.positionSuggestionBox(inputId);
        }
        
        inputState.isInitialFocus = false;
    }
    
    handleBlur(inputId, event) {
        const inputField = document.getElementById(inputId);
        const inputState = this.inputStates[inputId];
        const suggestionBox = this.suggestionBoxes[inputId];
        
        if (!inputField || !inputState) return;
        
        inputState.isProcessingBlur = true;
        
        const currentValue = inputField.value.trim();
        const selectedIata = inputField.getAttribute('data-selected-iata');
        
        // Cache the placeholder - no need to set it again if already present
        const placeholder = inputField.placeholder;
        
        const isValidSelection = 
            (currentValue === 'Anywhere' && selectedIata === 'Any') || 
            (selectedIata && selectedIata !== 'Any' && currentValue.includes(`(${selectedIata})`));
        
        if (currentValue && !isValidSelection) {
            if (inputState.previousValidValue) {
                inputField.value = inputState.previousValidValue;
                
                if (inputState.previousIataCode) {
                    inputField.setAttribute('data-selected-iata', inputState.previousIataCode);
                } else {
                    inputField.removeAttribute('data-selected-iata');
                }
                
                if (inputState.previousValidValue === 'Anywhere') {
                    inputField.setAttribute('data-is-any-destination', 'true');
                } else {
                    inputField.removeAttribute('data-is-any-destination');
                }
            } else {
                inputField.value = '';
                inputField.removeAttribute('data-selected-iata');
                inputField.removeAttribute('data-is-any-destination');
            }
        }
        
        const finalValue = inputField.value;
        const isAnyDestination = 
            finalValue === 'Anywhere' ||
            inputField.getAttribute('data-is-any-destination') === 'true';
            
        if (this.isMobile() && inputState.isExpanded) {
            this.revertInput(inputId);
            inputState.isExpanded = false;
        }

        if (suggestionBox) suggestionBox.style.display = 'none';
        
        // Simplify readonly state management
        inputField.readOnly = Boolean(finalValue.trim());
        
        if (!isAnyDestination && !window.preserveAnyDestination && 
            finalValue === '' && !appState.isRouteSwitching && !appState.searchResultsLoading) {
            
            const waypointIndex = parseInt(inputId.replace(/\D/g, ''), 10) - 1;
            const routeNumber = Math.floor(waypointIndex / 2);
            const isOrigin = waypointIndex % 2 === 0;
            
            // Check if this waypoint exists in routeData and is not "Any"
            const route = appState.routeData[routeNumber];
            const waypoint = isOrigin ? route?.origin : route?.destination;
            
            if (route && waypoint && waypoint.iata_code !== 'Any') {
                // Replace removeWaypoint with updateRouteData
                const updateData = {};
                updateData[isOrigin ? 'origin' : 'destination'] = null;
                
                updateState('updateRouteData', {
                    routeNumber,
                    data: updateData
                }, 'inputManager.handleBlur');
            }
        }
        
        inputState.isProcessingBlur = false;
    }
    
    handleKeyDown(inputId, event) {
        const inputField = document.getElementById(inputId);
        const suggestionBox = this.suggestionBoxes[inputId];
        const inputState = this.inputStates[inputId];
        
        if (!suggestionBox || !inputField || !inputState) return;
        
        const suggestions = Array.from(suggestionBox.querySelectorAll('div'));
        const isVisible = suggestionBox.style.display === 'block' && suggestions.length > 0;
        
        if (!isVisible) {
            inputState.selectedSuggestionIndex = -1;
            if (event.key === 'Enter') {
                event.preventDefault();
                
                if (!this.isMobile()) {
                    this.focusPairedInputField(inputId);
                    return;
                }
                
                event.target.blur();
            }
            return;
        }
        
        switch (event.key) {
            case 'ArrowDown':
                event.preventDefault();
                this.navigateSuggestion(inputId, 1);
                break;
                
            case 'ArrowUp':
                event.preventDefault();
                this.navigateSuggestion(inputId, -1);
                break;
                
            case 'Enter':
                event.preventDefault();
                if (inputState.selectedSuggestionIndex >= 0 && 
                    inputState.selectedSuggestionIndex < suggestions.length) {
                    suggestions[inputState.selectedSuggestionIndex].click();
                } else if (suggestions.length > 0) {
                    suggestions[0].click();
                } else {
                    if (!this.isMobile()) {
                        this.focusPairedInputField(inputId);
                    } else {
                        inputField.blur();
                    }
                }
                break;
                
            case 'Escape':
                event.preventDefault();
                suggestionBox.style.display = 'none';
                inputState.selectedSuggestionIndex = -1;
                break;
                
            case 'Tab':
                suggestionBox.style.display = 'none';
                inputState.selectedSuggestionIndex = -1;
                break;
        }
    }
    
    navigateSuggestion(inputId, direction) {
        const suggestionBox = this.suggestionBoxes[inputId];
        const inputState = this.inputStates[inputId];
        
        if (!suggestionBox || !inputState) return;
        
        const suggestions = Array.from(suggestionBox.querySelectorAll('div'));
        if (!suggestions.length) return;
        
        suggestions.forEach(item => item.classList.remove('selected'));
        
        let newIndex = inputState.selectedSuggestionIndex + direction;
        if (newIndex < 0) newIndex = suggestions.length - 1;
        if (newIndex >= suggestions.length) newIndex = 0;
        
        inputState.selectedSuggestionIndex = newIndex;
        const selectedItem = suggestions[newIndex];
        selectedItem.classList.add('selected');
        selectedItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        
        const inputField = document.getElementById(inputId);
        if (inputField) {
            inputField.setAttribute('aria-activedescendant', selectedItem.id || '');
        }
    }
    
    handleInput(inputId) {
        if (this.inputStates[inputId]) {
            this.inputStates[inputId].selectedSuggestionIndex = -1;
        }
    }

    positionSuggestionBox(inputId) {
        const input = document.getElementById(inputId);
        const suggestionBox = this.suggestionBoxes[inputId];
        
        if (!input || !suggestionBox) return;
        
        // Get the most accurate position using getBoundingClientRect
        const rect = input.getBoundingClientRect();
        
        // Check if input is actually visible
        if (rect.width === 0 && rect.height === 0) {
            suggestionBox.style.display = 'none';
            return;
        }
        
        // Default to positioning above the input element
        // Calculate the position for the suggestion box
        const left = rect.left;
        const top = rect.top;
        const width = Math.max(rect.width, 200); // Minimum width of 200px

        // Get the actual height of the suggestion box
        const boxHeight = suggestionBox.offsetHeight || 200; // Default height if not rendered yet

        // Position the box above the input by default
        suggestionBox.style.position = 'fixed';
        suggestionBox.style.left = `${left}px`;
        suggestionBox.style.width = `${width}px`;
        suggestionBox.style.top = `${top - boxHeight}px`; // Position above the input
        suggestionBox.style.bottom = 'auto';
        suggestionBox.style.zIndex = '10000'; // Ensure it's always on top
        
        // Add appropriate class for styling
        suggestionBox.classList.add('suggestions-above');
        suggestionBox.classList.remove('suggestions-below');
        
        // Show the box if suggestions exist and should be shown
        if (this.inputStates[inputId]?.showSuggestions && 
            this.inputStates[inputId]?.suggestions?.length > 0) {
            suggestionBox.style.display = 'block';
        }
    }

    repositionAllSuggestionBoxes() {
        Object.keys(this.suggestionBoxes).forEach(id => {
            const input = document.getElementById(id);
            const box = this.suggestionBoxes[id];
            
            if (input && document.body.contains(input) && box) {
                this.positionSuggestionBox(id);
            }
        });
    }

    expandInput(inputId) {
        const inputField = document.getElementById(inputId);
        const suggestionBox = this.suggestionBoxes[inputId];
        
        if (!inputField) return;
        
        inputField.classList.add('expanded-input');
        
        if (suggestionBox) {
            suggestionBox.classList.add('expanded-suggestions');
            
            if (this.isMobile()) {
                Object.assign(suggestionBox.style, {
                    position: 'fixed',
                    top: '50px',
                    left: '0',
                    width: '100%',
                    maxHeight: 'calc(100vh - 50px)',
                    zIndex: '10000',
                    display: suggestionBox.children.length > 0 ? 'block' : 'none'
                });
            }
        }
        
        this.addBackButton(inputId);
    }
    
    addBackButton(inputId) {
        const inputField = document.getElementById(inputId);
        if (!inputField || inputField.parentElement.querySelector('.back-button')) return;
        
        const backButton = document.createElement('button');
        backButton.className = 'back-button';
        backButton.innerHTML = `
            <svg viewBox="0 0 24 24">
                <line x1="22" y1="12" x2="4" y2="12" />
                <line x1="12" y1="3" x2="3" y2="12" />
                <line x1="12" y1="21" x2="3" y2="12" />
            </svg>
        `;
        
        backButton.onclick = this.debounce((event) => {
            event.preventDefault();
            event.stopPropagation();
            
            inputField.value = '';
            
            const overlay = document.querySelector('.route-box-overlay');
            if (overlay) {
                overlay.classList.remove('active');
                setTimeout(() => overlay.remove(), 200);
            }
            
            const waypointIndex = parseInt(inputId.replace(/\D/g, ''), 10) - 1;
            const routeNumber = Math.floor(waypointIndex / 2);
            const isOrigin = waypointIndex % 2 === 0;
            
            // Update using updateRouteData instead of removeWaypoint
            const updateData = {};
            updateData[isOrigin ? 'origin' : 'destination'] = null;
            
            updateState('updateRouteData', {
                routeNumber,
                data: updateData
            }, 'inputManager.backButton');
            
            inputField.blur();
        }, 300, `back-${inputId}`);
        
        inputField.parentElement.appendChild(backButton);
    }
    
    revertInput(inputId) {
        const inputField = document.getElementById(inputId);
        const suggestionBox = this.suggestionBoxes[inputId];
        
        if (!inputField) return;
        
        const overlay = document.querySelector('.route-box-overlay');
        if (overlay) {
            overlay.classList.remove('active');
            setTimeout(() => {
                if (document.body.contains(overlay)) {
                    overlay.remove();
                }
            }, 300);
        }
        
        inputField.classList.remove('expanded-input');
        
        if (suggestionBox) {
            suggestionBox.classList.remove('expanded-suggestions');
            suggestionBox.style.display = 'none';
        }
        
        const backButton = inputField.parentElement?.querySelector('.back-button');
        if (backButton) {
            backButton.remove();
        }
    }
    
    createMobileOverlay() {
        const existingOverlay = document.querySelector('.route-box-overlay');
        if (existingOverlay) {
            existingOverlay.remove();
        }
        
        if (appState.searchResultsLoading) return;
        
        // Check if there are any active routes in routeData
        const hasActiveRoutes = appState.routeData.some(route => 
            route && !route.isEmpty && (route.origin || route.destination)
        );
        
        if (!hasActiveRoutes) return;
        
        const routeBox = document.querySelector('.route-box');
        if (!routeBox) return;
        
        const overlay = document.createElement('div');
        overlay.className = 'route-box-overlay mobile-overlay';
        overlay.style.zIndex = '90';
        
        const handleOverlayInteraction = (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            if (document.activeElement && document.activeElement.tagName === 'INPUT') {
                const input = document.activeElement;
                const preventFocus = e => e.preventDefault();
                input.addEventListener('focus', preventFocus, { once: true, capture: true });
                input.blur();
                setTimeout(() => input.removeEventListener('focus', preventFocus, true), 200);
            }
        };
        
        overlay.addEventListener('mousedown', handleOverlayInteraction);
        overlay.addEventListener('click', handleOverlayInteraction);
        
        routeBox.appendChild(overlay);
        
        requestAnimationFrame(() => {
            if (overlay && document.body.contains(overlay)) {
                overlay.classList.add('active');
            }
        });
    }
    
    // Helper method to get a waypoint from routeData
    getWaypointFromRouteData(waypointIndex) {
        const routeNumber = Math.floor(waypointIndex / 2);
        const isOrigin = waypointIndex % 2 === 0;
        const route = appState.routeData[routeNumber];
        
        if (!route || route.isEmpty) return null;
        
        return isOrigin ? route.origin : route.destination;
    }
    
    // Helper method to determine if a route exists and has origin/destination
    doesRouteExist(routeNumber) {
        const route = appState.routeData[routeNumber];
        return route && !route.isEmpty && (route.origin || route.destination);
    }
    
    // Update to use routeData directly
    syncInputWithWaypoint(inputId) {
        const inputField = document.getElementById(inputId);
        if (!inputField) return;
        
        const waypointIndex = parseInt(inputId.replace(/\D/g, ''), 10) - 1;
        const waypoint = this.getWaypointFromRouteData(waypointIndex);
        const inputState = this.inputStates[inputId] || {};
        
        // Reset if no waypoint
        if (!waypoint) {
            inputField.value = '';
            inputField.removeAttribute('data-selected-iata');
            inputField.removeAttribute('data-is-any-destination');
            inputField.readOnly = false;
            
            if (this.inputStates[inputId]) {
                this.inputStates[inputId].previousValidValue = '';
                this.inputStates[inputId].previousIataCode = null;
            }
            return;
        }
        
        // Handle "Anywhere" case - make this check more explicit to avoid false positives
        const isAnyDestination = waypoint.iata_code === 'Any' || 
                               waypoint.isAnyDestination === true || 
                               waypoint.isAnyOrigin === true;
        
        // Set all values at once - make the logic more explicit for regular airports
        if (isAnyDestination) {
            inputField.value = 'Anywhere';
            inputField.setAttribute('data-selected-iata', 'Any');
            inputField.setAttribute('data-is-any-destination', 'true');
        } else {
            // For regular airports, always use city and iata code
            inputField.value = `${waypoint.city}, (${waypoint.iata_code})`;
            inputField.setAttribute('data-selected-iata', waypoint.iata_code);
            inputField.removeAttribute('data-is-any-destination');
        }
        
        inputField.readOnly = true;
        
        // Update input state
        if (this.inputStates[inputId]) {
            this.inputStates[inputId].previousValidValue = inputField.value;
            this.inputStates[inputId].previousIataCode = waypoint.iata_code;
        }
    }
    
    isMobile() {
        return window.innerWidth <= 600;
    }
    
    setFocusToNextUnsetInput() {
        if (this.isMobile()) return;

        const waypointInputs = document.querySelectorAll('.waypoint-input[type="text"]');
        requestAnimationFrame(() => {
            for (let input of waypointInputs) {
                if (!input.value) {
                    input.focus();
                    break;
                }
            }
        });
    }
    
    cleanupInput(inputId) {
        console.log(`Cleaning up input ${inputId}`);
        
        // Remove suggestion box
        if (this.suggestionBoxes[inputId]) {
            const box = this.suggestionBoxes[inputId];
            if (box && document.body.contains(box)) {
                box.remove();
            }
            delete this.suggestionBoxes[inputId];
        }
        
        // Clean up event listeners
        this.cleanupInputListeners(inputId);
        
        // Remove input state
        delete this.inputStates[inputId];
        
        // Clear debounce timers
        delete this.debounceTimers[`autocomplete-${inputId}`];
        delete this.debounceTimers[`input-${inputId}`];
    }
    
    cleanupAll() {
        console.log("Cleaning up all input resources");
        
        // Clean up all suggestion boxes
        Object.keys(this.suggestionBoxes).forEach(inputId => {
            this.cleanupInput(inputId);
        });
        
        // Additional cleanup of any suggestion divs left in DOM
        document.querySelectorAll('.suggestions').forEach(box => {
            if (box.id && box.id.includes('Suggestions')) {
                box.remove();
            }
        });
        
        this.suggestionBoxes = {};
        this.inputStates = {};
        this.debounceTimers = {};
    }
    
    cleanup() {
        // Disconnect all resize observers
        this.resizeObservers.forEach(observer => observer.disconnect());
        this.resizeObservers = [];
        
        // Disconnect mutation observer
        if (this.mutationObserver) {
            this.mutationObserver.disconnect();
            this.mutationObserver = null;
        }
        
        // Clean up suggestion boxes
        Object.values(this.suggestionBoxes).forEach(box => {
            if (box && document.body.contains(box)) {
                box.remove();
            }
        });
        
        this.suggestionBoxes = {};
        this.inputStates = {};
        
        Object.keys(this.inputStates).forEach(inputId => {
            this.cleanupInputListeners(inputId);
        });
        
        document.querySelectorAll('.route-box-overlay').forEach(overlay => {
            overlay.remove();
        });
    }

    focusPairedInputField(inputId) {
        if (this.isMobile()) return;
        
        const inputNumber = parseInt(inputId.replace(/\D/g, ''), 10);
        const waypointIndex = inputNumber - 1;
        const isOriginField = waypointIndex % 2 === 0;
        
        if (isOriginField) {
            // If this is an origin field, focus the destination field
            const destId = `waypoint-input-${inputNumber + 1}`;
            const destField = document.getElementById(destId);
            
            if (destField && !destField.value.trim()) {
                requestAnimationFrame(() => destField.focus());
            }
        } else {
            // If this is a destination field, check if we need to create a new route
            const routeNumber = Math.floor(waypointIndex / 2);
            const nextRouteNumber = routeNumber + 1;
            
            // Check if we have a complete route (both origin and destination)
            const currentRoute = appState.routeData[routeNumber];
            if (currentRoute && currentRoute.origin && currentRoute.destination) {
                // Check if next route already exists
                const nextRouteExists = appState.routeData[nextRouteNumber] && 
                    (appState.routeData[nextRouteNumber].origin || 
                     appState.routeData[nextRouteNumber].destination);
                
                if (!nextRouteExists) {
                    // Focus the next origin field
                    const nextOriginId = `waypoint-input-${(nextRouteNumber * 2) + 1}`;
                    const nextOriginField = document.getElementById(nextOriginId);
                    
                    if (nextOriginField) {
                        requestAnimationFrame(() => nextOriginField.focus());
                    }
                }
            }
        }
    }

    handleAirportSelection(inputId, airport) {
        console.log(`Airport selected for ${inputId}:`, airport);
        
        // Check if the airport data is valid before proceeding
        if (!airport) {
            console.warn(`Invalid airport data for ${inputId}`);
            return;
        }
        
        // Get information about the current field
        const waypointIndex = parseInt(inputId.replace(/\D/g, ''), 10) - 1;
        const routeNumber = Math.floor(waypointIndex / 2);
        const isOrigin = waypointIndex % 2 === 0;
        
        // Update directly in routeData
        if (!appState.routeData[routeNumber]) {
            appState.routeData[routeNumber] = {
                tripType: 'oneWay',
                travelers: 1,
                departDate: null,
                returnDate: null
            };
        }
        
        // Use updateRouteData to update the field
        const updateData = {};
        if (isOrigin) {
            updateData.origin = airport;
        } else {
            updateData.destination = airport;
        }
        
        updateState('updateRouteData', {
            routeNumber,
            data: updateData
        }, 'inputManager.handleAirportSelection');
        
        // Find the paired field
        const pairIndex = isOrigin ? waypointIndex + 1 : waypointIndex - 1;
        const pairFieldId = `waypoint-input-${pairIndex + 1}`;
        const pairField = document.getElementById(pairFieldId);
        
        console.log(`Paired field for ${inputId} is ${pairFieldId}, exists: ${Boolean(pairField)}`);

        if (this.isMobile()) {
            console.log(`Mobile device detected, not focusing pair field`);
            return;
        }
        
        // Origin field focusing destination
        if (isOrigin) {
            if (pairField) {
                // Check for empty value - ensure we check against 'Anywhere' and empty string
                const pairValue = pairField.value.trim();
                const isAnyDestination = pairField.getAttribute('data-is-any-destination') === 'true';
                const iataCode = pairField.getAttribute('data-selected-iata');
                
                // Consider "Anywhere" as NOT a valid value for focusing purposes
                const isAnywhere = pairValue === 'Anywhere' || isAnyDestination || iataCode === 'Any';
                const hasValidDestination = pairValue !== '' && !isAnywhere;
                
                console.log(`Destination field check: value="${pairValue}", isAny=${isAnywhere}, hasValid=${hasValidDestination}`);
                
                // Only focus if it's truly empty or set to Anywhere and we just set the origin
                if (!hasValidDestination) {
                    // Clear the "Anywhere" value before focusing to start fresh
                    if (isAnywhere && airport.iata_code !== 'Any') {
                        console.log(`Clearing Anywhere from destination field before focusing`);
                        pairField.value = '';
                        pairField.removeAttribute('data-selected-iata');
                        pairField.removeAttribute('data-is-any-destination');
                        pairField.readOnly = false;
                        
                        // Also clear from routeData
                        const route = appState.routeData[routeNumber];
                        if (route) {
                            route.destination = null;
                        }
                    }
                    
                    console.log(`Focusing empty/anywhere destination field ${pairFieldId}`);
                    
                    // Set up destination for automatic suggestions after focus
                    const routeData = appState.routeData[routeNumber];
                    if (routeData && routeData.origin && routeData.origin.iata_code !== 'Any') {
                        // Set a special flag to enable automatic suggestions
                        routeData._destinationNeedsEmptyFocus = true;
                    }
                    
                    // Use direct focus here
                    pairField.focus();
                    
                    // Immediate trigger for suggestions - don't wait for the normal focus event
                    import('./airportAutocomplete.js').then(module => {
                        module.updateSuggestions(pairFieldId, []);
                    });
                } else {
                    console.log(`Destination field ${pairFieldId} already has value: "${pairValue}"`);
                }
            } else {
                console.log(`Destination field ${pairFieldId} doesn't exist`);
            }
        } else {
            // Handle destination field selection - may need to focus origin if it's empty
            if (pairField) {
                const pairValue = pairField.value.trim();
                const isAnyOrigin = pairField.getAttribute('data-is-any-destination') === 'true';
                const iataCode = pairField.getAttribute('data-selected-iata');
                
                // Check if origin is empty or set to Anywhere
                const isAnywhere = pairValue === 'Anywhere' || isAnyOrigin || iataCode === 'Any';
                const hasValidOrigin = pairValue !== '' && !isAnywhere;
                
                console.log(`Origin field check: value="${pairValue}", isAny=${isAnywhere}, hasValid=${hasValidOrigin}`);
                
                if (!hasValidOrigin) {
                    // If destination is set but origin is empty, focus the origin field
                    console.log(`Focusing empty/anywhere origin field ${pairFieldId}`);
                    
                    // Clear the "Anywhere" value if it's set
                    if (isAnywhere && airport.iata_code !== 'Any') {
                        console.log(`Clearing Anywhere from origin field before focusing`);
                        pairField.value = '';
                        pairField.removeAttribute('data-selected-iata');
                        pairField.removeAttribute('data-is-any-destination');
                        pairField.readOnly = false;
                        
                        // Also clear from routeData
                        const route = appState.routeData[routeNumber];
                        if (route) {
                            route.origin = null;
                        }
                    }
                    
                    // Set a flag in route data for the origin field
                    const routeData = appState.routeData[routeNumber];
                    if (routeData && routeData.destination && routeData.destination.iata_code !== 'Any') {
                        routeData._originNeedsEmptyFocus = true;
                    }
                    
                    // Focus the origin field
                    pairField.focus();
                    
                    // Trigger suggestions immediately
                    import('./airportAutocomplete.js').then(module => {
                        module.updateSuggestions(pairFieldId, []);
                    });
                    
                    return;
                }
            }
            
            // If not focusing the origin, check if we should create a new route
            const nextRouteNumber = routeNumber + 1;
            const nextOriginId = `waypoint-input-${(nextRouteNumber * 2) + 1}`;
            const nextOriginField = document.getElementById(nextOriginId);
            
            // Check if we have a complete route and the next route doesn't exist yet
            const currentRoute = appState.routeData[routeNumber];
            
            // Check if next route already exists in routeData
            const nextRouteExists = appState.routeData[nextRouteNumber] && 
                (appState.routeData[nextRouteNumber].origin || 
                 appState.routeData[nextRouteNumber].destination);
            
            if (currentRoute && currentRoute.origin && currentRoute.destination && !nextRouteExists && nextOriginField) {
                console.log(`Focusing next origin field ${nextOriginId}`);
                nextOriginField.focus();
            } else {
                console.log(`No need to focus next field: complete route=${Boolean(currentRoute?.origin && currentRoute?.destination)}, nextRouteExists=${nextRouteExists}, nextOriginField=${Boolean(nextOriginField)}`);
            }
        }
    }

    init() {
        // Set up event listeners for window events
        window.addEventListener('resize', () => this.repositionAllSuggestionBoxes());
        window.addEventListener('scroll', () => this.repositionAllSuggestionBoxes());
        
        // Set up observers for InfoPane resizing
        this.setupResizeObservers();
        
        // Set up mutation observer for DOM changes
        this.setupMutationObserver();
        
        console.log("InputManager initialized with positioning enhancement");
    }
    
    setupResizeObservers() {
        const infoPaneElement = document.getElementById('infoPane');
        if (infoPaneElement && window.ResizeObserver) {
            const observer = new ResizeObserver(() => {
                this.repositionAllSuggestionBoxes();
            });
            
            observer.observe(infoPaneElement);
            this.resizeObservers.push(observer);
        }
        
        // Also observe the resize handle for drag operations
        const resizeHandle = document.getElementById('resizeHandle');
        if (resizeHandle) {
            resizeHandle.addEventListener('mousedown', () => {
                // Track dragging with an interval for continuous updates
                const dragInterval = setInterval(() => {
                    this.repositionAllSuggestionBoxes();
                }, 10);
                
                // Clear interval when dragging stops
                const stopDragging = () => {
                    clearInterval(dragInterval);
                    document.removeEventListener('mouseup', stopDragging);
                    this.repositionAllSuggestionBoxes(); // One final update
                };
                
                document.addEventListener('mouseup', stopDragging);
            });
        }
        
        // Monitor transitions on the InfoPane
        if (infoPaneElement) {
            infoPaneElement.addEventListener('transitionend', () => {
                this.repositionAllSuggestionBoxes();
            });
        }
    }
    
    setupMutationObserver() {
        if (this.mutationObserver) {
            this.mutationObserver.disconnect();
        }
        
        this.mutationObserver = new MutationObserver((mutations) => {
            let needsUpdate = false;
            
            for (const mutation of mutations) {
                // Check if the mutation involves one of our input fields or their ancestors
                const affectsInputs = mutation.target.id === 'infoPaneContent' || 
                    mutation.target.id === 'routeBoxContainer' ||
                    mutation.target.classList?.contains('input-wrapper') ||
                    mutation.target.querySelector('.waypoint-input');
                    
                if (affectsInputs) {
                    needsUpdate = true;
                    break;
                }
                
                // Also check if style or class attributes changed that could affect position
                if (mutation.type === 'attributes' && 
                    (mutation.attributeName === 'style' || mutation.attributeName === 'class')) {
                    const isRelevantElement = mutation.target.id === 'infoPane' ||
                        mutation.target.classList?.contains('route-box') ||
                        mutation.target.classList?.contains('input-wrapper');
                        
                    if (isRelevantElement) {
                        needsUpdate = true;
                        break;
                    }
                }
            }
            
            if (needsUpdate) {
                this.repositionAllSuggestionBoxes();
            }
        });
        
        // Observe the entire infoPane for changes
        const infoPane = document.getElementById('infoPane');
        if (infoPane) {
            this.mutationObserver.observe(infoPane, { 
                childList: true, 
                subtree: true, 
                attributes: true,
                attributeFilter: ['style', 'class'] 
            });
        }
    }
}

const inputManager = new InputManager();

// Initialize on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    inputManager.init();
});

export { inputManager };

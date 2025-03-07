import { appState, updateState } from './stateManager.js';
import { map } from './map.js';
import { fetchAirportByIata, updateSuggestions } from './airportAutocomplete.js';

/**
 * InputManager - Centralized management for waypoint input fields
 * Handles focus, blur, suggestions, and mobile/desktop specific behaviors
 */
class InputManager {
    constructor() {
        this.debounceTimers = {};
        this.suggestionBoxes = {};
        this.inputStates = {};
    }

    /**
     * Debounce helper function
     */
    debounce(func, delay, id) {
        const timerId = id || Math.random().toString(36);
        return (...args) => {
            clearTimeout(this.debounceTimers[timerId]);
            this.debounceTimers[timerId] = setTimeout(() => func(...args), delay);
            return timerId;
        };
    }

    /**
     * Initialize input state tracking for a specific field
     */
    initInputState(inputId) {
        if (!this.inputStates[inputId]) {
            this.inputStates[inputId] = {
                isInitialFocus: true,
                isExpanded: false,
                isProcessingBlur: false,
                hasSuggestions: false,
                selectedIata: null,
                isAnyDestination: false,
                selectedSuggestionIndex: -1, // Add tracking for keyboard navigation
                previousValidValue: '', // Track the previous valid value
                previousIataCode: null, // Track the previous valid IATA code
            };
        }
        return this.inputStates[inputId];
    }

    /**
     * Setup a waypoint input field with all event handlers
     */
    setupWaypointInput(inputId, options = {}) {
        const inputField = document.getElementById(inputId);
        if (!inputField) return null;

        const routeNumber = parseInt(inputId.replace(/\D/g, ''), 10) - 1;
        const waypointIndex = routeNumber;
        const isOriginField = waypointIndex % 2 === 0;
        const inputState = this.initInputState(inputId);
        
        // Clean up any previous event listeners
        this.cleanupInputListeners(inputId);
        
        // Set necessary attributes
        inputField.setAttribute('autocomplete', 'new-password');
        inputField.setAttribute('name', `waypoint-input-${Date.now()}`);
        inputField.setAttribute('role', 'combobox');
        inputField.setAttribute('aria-autocomplete', 'list');
        inputField.setAttribute('aria-expanded', 'false');
        
        // Create or reference suggestion box
        const suggestionBox = this.ensureSuggestionBox(inputId);
        
        // Set up event handlers with proper binding
        const handlers = {
            focus: this.handleFocus.bind(this, inputId),
            blur: this.handleBlur.bind(this, inputId),
            input: this.debounce(this.handleInput.bind(this, inputId), 200, `input-${inputId}`),
            keydown: this.handleKeyDown.bind(this, inputId)
        };
        
        // Attach all events to input field
        Object.entries(handlers).forEach(([event, handler]) => {
            inputField.addEventListener(event, handler);
        });
        
        // Store handler references for cleanup
        inputState.handlers = handlers;
        
        // Initialize from waypoint data if available
        this.syncInputWithWaypoint(inputId);
        
        return inputField;
    }
    
    /**
     * Create or ensure a suggestion box exists for an input
     */
    ensureSuggestionBox(inputId) {
        let suggestionBox = document.getElementById(`${inputId}Suggestions`);
        
        // Remove existing suggestion box if it exists
        if (suggestionBox) {
            suggestionBox.remove();
        }
        
        // Create new suggestion box
        suggestionBox = document.createElement('div');
        suggestionBox.id = `${inputId}Suggestions`;
        suggestionBox.className = 'suggestions';
        suggestionBox.setAttribute('role', 'listbox');
        
        // Add to DOM at body level for consistent positioning
        document.body.appendChild(suggestionBox);
        
        // Store reference
        this.suggestionBoxes[inputId] = suggestionBox;
        
        return suggestionBox;
    }
    
    /**
     * Clean up event listeners for an input
     */
    cleanupInputListeners(inputId) {
        const inputField = document.getElementById(inputId);
        const inputState = this.inputStates[inputId];
        
        if (inputField && inputState?.handlers) {
            Object.entries(inputState.handlers).forEach(([event, handler]) => {
                inputField.removeEventListener(event, handler);
            });
        }
    }
    
    /**
     * Handle input focus event
     */
    handleFocus(inputId, event) {
        const inputField = document.getElementById(inputId);
        const inputState = this.inputStates[inputId];
        const suggestionBox = this.suggestionBoxes[inputId];     
        if (!inputField || !inputState) return;
        
        // Store current valid value before user starts typing
        inputState.previousValidValue = inputField.value;
        inputState.previousIataCode = inputField.getAttribute('data-selected-iata');
        
        // Remove readonly attribute to allow typing
        inputField.removeAttribute('readonly');
        
        // Handle mobile-specific behavior
        if (this.isMobile()) {
            if (!inputState.isExpanded) {
                this.createMobileOverlay();
                this.expandInput(inputId);
                inputState.isExpanded = true;
            }
        } else {
            // Handle desktop behavior
            if (suggestionBox && suggestionBox.children.length > 0) {
                this.positionSuggestionBox(inputId);
                suggestionBox.style.display = 'block';
            }
        }
        
        // Select all text for better UX
        requestAnimationFrame(() => {
            inputField.select();
        });
        
        // Check if we need to fly to the selected airport
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

        if (!inputField.value.trim()) {
          // Make sure airportAutocomplete's updateSuggestions is accessible here
          updateSuggestions(inputId, []);
          suggestionBox.style.display = 'block';
        }
        
        inputState.isInitialFocus = false;
    }
    
    /**
     * Handle input blur event
     */
    handleBlur(inputId, event) {
        const inputField = document.getElementById(inputId);
        const inputState = this.inputStates[inputId];
        const suggestionBox = this.suggestionBoxes[inputId];
        
        if (!inputField || !inputState) return;
        
        // Set processing flag to prevent race conditions
        inputState.isProcessingBlur = true;
        
        // Get current input value and check if it's valid
        const currentValue = inputField.value.trim();
        const selectedIata = inputField.getAttribute('data-selected-iata');
        
        // Check if a valid selection was made
        const isValidSelection = 
            (currentValue === 'Anywhere' && selectedIata === 'Any') || 
            (selectedIata && selectedIata !== 'Any' && currentValue.includes(`(${selectedIata})`));
        
        // If no valid selection, revert to previous valid value
        if (currentValue && !isValidSelection) {
            // Restore previous value if available, otherwise clear the field
            if (inputState.previousValidValue) {
                inputField.value = inputState.previousValidValue;
                
                // Also restore the data attribute
                if (inputState.previousIataCode) {
                    inputField.setAttribute('data-selected-iata', inputState.previousIataCode);
                } else {
                    inputField.removeAttribute('data-selected-iata');
                }
                
                // If it was "Anywhere", restore that attribute too
                if (inputState.previousValidValue === 'Anywhere') {
                    inputField.setAttribute('data-is-any-destination', 'true');
                } else {
                    inputField.removeAttribute('data-is-any-destination');
                }
            } else {
                // Clear field if no previous valid value
                inputField.value = '';
                inputField.removeAttribute('data-selected-iata');
                inputField.removeAttribute('data-is-any-destination');
            }
        }
        
        // Store existing value for waypoint handling
        const finalValue = inputField.value;
        const isAnyDestination = 
            finalValue === 'Anywhere' ||
            inputField.getAttribute('data-is-any-destination') === 'true';
            
        // For mobile, revert UI changes
        if (this.isMobile() && inputState.isExpanded) {
            this.revertInput(inputId);
            inputState.isExpanded = false;
        }
        
        // Hide suggestion box after a delay to allow for selection
        setTimeout(() => {
            if (suggestionBox) {
                suggestionBox.style.display = 'none';
            }
            
            // Set readonly back for better mobile behavior
            inputField.setAttribute('readonly', true);
            
            // Process waypoint changes if needed
            if (!isAnyDestination && !window.preserveAnyDestination && 
                finalValue === '' && appState.waypoints.length > 0 && 
                !appState.isRouteSwitching && !appState.searchResultsLoading) {
                
                const waypointIndex = parseInt(inputId.replace(/\D/g, ''), 10) - 1;
                
                if (waypointIndex >= 0 && waypointIndex < appState.waypoints.length) {
                    if (appState.waypoints[waypointIndex] && 
                        appState.waypoints[waypointIndex].iata_code !== 'Any') {
                        updateState('removeWaypoint', waypointIndex, 'inputManager.handleBlur');
                    }
                }
            }
            
            // Reset processing flag
            inputState.isProcessingBlur = false;
        }, 300);
    }
    
    /**
     * Handle input keydown event
     */
    handleKeyDown(inputId, event) {
        const inputField = document.getElementById(inputId);
        const suggestionBox = this.suggestionBoxes[inputId];
        const inputState = this.inputStates[inputId];
        
        if (!suggestionBox || !inputField || !inputState) return;
        
        const suggestions = Array.from(suggestionBox.querySelectorAll('div'));
        const isVisible = suggestionBox.style.display === 'block' && suggestions.length > 0;
        
        // Reset selection index if suggestions aren't visible
        if (!isVisible) {
            inputState.selectedSuggestionIndex = -1;
            // Process Enter key for non-suggestion cases
            if (event.key === 'Enter') {
                event.preventDefault();
                
                if (!this.isMobile()) {
                    const inputNumber = parseInt(inputId.replace(/\D/g, ''), 10);
                    const isOriginField = (inputNumber - 1) % 2 === 0;
                    
                    if (isOriginField) {
                        // If this is an origin field, focus destination field
                        const destId = `waypoint-input-${inputNumber + 1}`;
                        const destField = document.getElementById(destId);
                        
                        if (destField && !destField.value.trim()) {
                            requestAnimationFrame(() => destField.focus());
                            return;
                        }
                    }
                }
                
                // Otherwise blur this field
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
                    // Trigger click on the selected suggestion
                    suggestions[inputState.selectedSuggestionIndex].click();
                } else if (suggestions.length > 0) {
                    // If no selection but suggestions exist, select the first one
                    suggestions[0].click();
                } else {
                    // No suggestions, move to next field or blur
                    const inputNumber = parseInt(inputId.replace(/\D/g, ''), 10);
                    const isOriginField = (inputNumber - 1) % 2 === 0;
                    
                    if (isOriginField && !this.isMobile()) {
                        const destId = `waypoint-input-${inputNumber + 1}`;
                        const destField = document.getElementById(destId);
                        if (destField && !destField.value.trim()) {
                            requestAnimationFrame(() => destField.focus());
                        }
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
                // Hide suggestions but allow default tab behavior
                suggestionBox.style.display = 'none';
                inputState.selectedSuggestionIndex = -1;
                break;
        }
    }
    
    /**
     * Navigate through suggestions using keyboard
     */
    navigateSuggestion(inputId, direction) {
        const suggestionBox = this.suggestionBoxes[inputId];
        const inputState = this.inputStates[inputId];
        
        if (!suggestionBox || !inputState) return;
        
        const suggestions = Array.from(suggestionBox.querySelectorAll('div'));
        if (!suggestions.length) return;
        
        // Remove current selection if any
        suggestions.forEach(item => item.classList.remove('selected'));
        
        // Calculate new index with wrapping
        let newIndex = inputState.selectedSuggestionIndex + direction;
        if (newIndex < 0) newIndex = suggestions.length - 1;
        if (newIndex >= suggestions.length) newIndex = 0;
        
        // Set new selection
        inputState.selectedSuggestionIndex = newIndex;
        const selectedItem = suggestions[newIndex];
        selectedItem.classList.add('selected');
        selectedItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        
        // Set aria attributes for accessibility
        const inputField = document.getElementById(inputId);
        if (inputField) {
            inputField.setAttribute('aria-activedescendant', selectedItem.id || '');
        }
    }
    
    /**
     * Handle input event - fetch suggestions
     */
    handleInput(inputId, event) {
        // Reset selection index when user types
        if (this.inputStates[inputId]) {
            this.inputStates[inputId].selectedSuggestionIndex = -1;
        }
        
        // Implementation to fetch airport suggestions would go here
        // This would be connected to the airport autocomplete functionality
    }
    
    /**
     * Position suggestion box based on input position
     */
    positionSuggestionBox(inputId) {
        const inputField = document.getElementById(inputId);
        const suggestionBox = this.suggestionBoxes[inputId];
        
        if (!suggestionBox || !inputField) return;

        const isMobile = this.isMobile();
        const inputRect = inputField.getBoundingClientRect();
        const waypointContainer = document.querySelector('.waypoint-inputs-container');
        const containerRect = waypointContainer ? waypointContainer.getBoundingClientRect() : null;
        const maxMenuHeight = 200;

        const waypointIndex = parseInt(inputField.id.replace(/\D/g, ''), 10) - 1;
        const isOriginField = waypointIndex % 2 === 0;

        const styles = {
            position: 'fixed',
            zIndex: '10000',
            display: suggestionBox.children.length > 0 ? 'block' : 'none',
        };

        if (isMobile) {
            Object.assign(styles, {
                top: '50px',
                left: '0',
                width: '100%',
                maxHeight: 'calc(100vh - 50px)',
                minHeight: 'none',
            });
        } else if (containerRect) {
            const viewportHeight = window.innerHeight;
            const spaceBelow = viewportHeight - inputRect.bottom;
            const spaceAbove = inputRect.top;
            const showAbove = spaceBelow < maxMenuHeight && spaceAbove >= maxMenuHeight;

            const suggestionWidth = containerRect.width;
            let left = isOriginField ? inputRect.left : (inputRect.right - suggestionWidth);
            left = Math.max(0, Math.min(left, window.innerWidth - suggestionWidth));

            Object.assign(styles, {
                width: `${suggestionWidth}px`,
                left: `${left}px`,
                maxHeight: `${Math.min(maxMenuHeight, showAbove ? spaceAbove : spaceBelow)}px`,
                [showAbove ? 'bottom' : 'top']: `${showAbove ? viewportHeight - inputRect.top : inputRect.bottom}px`,
                [showAbove ? 'top' : 'bottom']: 'auto',
            });
        } else {
            Object.assign(styles, {
                width: `${inputRect.width}px`,
                left: `${inputRect.left}px`,
                maxHeight: `${maxMenuHeight}px`,
                top: `${inputRect.bottom}px`,
                bottom: 'auto',
            });
        }

        Object.assign(suggestionBox.style, styles);
    }
    
    /**
     * Expand input for mobile view
     */
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
        
        // Add back button
        this.addBackButton(inputId);
    }
    
    /**
     * Add back button for mobile expanded view
     */
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
            
            // Clear input value
            inputField.value = '';
            
            // Remove overlay with animation
            const overlay = document.querySelector('.route-box-overlay');
            if (overlay) {
                overlay.classList.remove('active');
                setTimeout(() => overlay.remove(), 200);
            }
            
            // Process waypoint removal
            const waypointIndex = parseInt(inputId.replace(/\D/g, ''), 10) - 1;
            updateState('removeWaypoint', waypointIndex, 'inputManager.backButton');
            
            // Blur input to close keyboard
            inputField.blur();
        }, 300, `back-${inputId}`);
        
        inputField.parentElement.appendChild(backButton);
    }
    
    /**
     * Revert input from expanded state
     */
    revertInput(inputId) {
        const inputField = document.getElementById(inputId);
        const suggestionBox = this.suggestionBoxes[inputId];
        
        if (!inputField) return;
        
        // Handle overlay
        const overlay = document.querySelector('.route-box-overlay');
        if (overlay) {
            overlay.classList.remove('active');
            setTimeout(() => {
                if (document.body.contains(overlay)) {
                    overlay.remove();
                }
            }, 300);
        }
        
        // Revert input
        inputField.classList.remove('expanded-input');
        
        // Handle suggestions
        if (suggestionBox) {
            suggestionBox.classList.remove('expanded-suggestions');
            suggestionBox.style.display = 'none';
        }
        
        // Remove back button
        const backButton = inputField.parentElement?.querySelector('.back-button');
        if (backButton) {
            backButton.remove();
        }
    }
    
    /**
     * Create overlay for mobile view
     */
    createMobileOverlay() {
        // Remove any existing overlay
        const existingOverlay = document.querySelector('.route-box-overlay');
        if (existingOverlay) {
            existingOverlay.remove();
        }
        
        // Skip if we're loading search results
        if (appState.searchResultsLoading) return;
        
        const routeBox = document.querySelector('.route-box');
        if (!routeBox) return;
        
        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'route-box-overlay mobile-overlay';
        overlay.style.zIndex = '90';
        
        // Handle overlay interaction
        const handleOverlayInteraction = (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Blur active input
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
        
        // Add to DOM
        routeBox.appendChild(overlay);
        
        // Activate with animation
        requestAnimationFrame(() => {
            if (overlay && document.body.contains(overlay)) {
                overlay.classList.add('active');
            }
        });
    }
    
    /**
     * Update input field with waypoint data
     */
    syncInputWithWaypoint(inputId) {
        const inputField = document.getElementById(inputId);
        if (!inputField) return;
        
        const waypointIndex = parseInt(inputId.replace(/\D/g, ''), 10) - 1;
        const waypoint = appState.waypoints[waypointIndex];
        
        if (!waypoint) {
            inputField.value = '';
            inputField.removeAttribute('data-selected-iata');
            inputField.removeAttribute('data-is-any-destination');
            
            // Update previous valid value when syncing
            if (this.inputStates[inputId]) {
                this.inputStates[inputId].previousValidValue = '';
                this.inputStates[inputId].previousIataCode = null;
            }
            return;
        }
        
        if (waypoint.iata_code === 'Any' || waypoint.isAnyDestination || waypoint.isAnyOrigin) {
            inputField.value = 'Anywhere';
            inputField.setAttribute('data-selected-iata', 'Any');
            inputField.setAttribute('data-is-any-destination', 'true');
            
            // Update previous valid value
            if (this.inputStates[inputId]) {
                this.inputStates[inputId].previousValidValue = 'Anywhere';
                this.inputStates[inputId].previousIataCode = 'Any';
            }
        } else {
            inputField.value = `${waypoint.city}, (${waypoint.iata_code})`;
            inputField.setAttribute('data-selected-iata', waypoint.iata_code);
            inputField.removeAttribute('data-is-any-destination');
            
            // Update previous valid value
            if (this.inputStates[inputId]) {
                this.inputStates[inputId].previousValidValue = inputField.value;
                this.inputStates[inputId].previousIataCode = waypoint.iata_code;
            }
        }
    }
    
    /**
     * Utility function to check if on mobile
     */
    isMobile() {
        return window.innerWidth <= 600;
    }
    
    /**
     * Set focus to next empty input field
     */
    setFocusToNextUnsetInput() {
        // Skip focusing on mobile devices
        if (this.isMobile()) {
            return;
        }

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
    
    /**
     * Cleanup all input managers and related elements
     */
    cleanup() {
        // Remove all suggestion boxes
        Object.values(this.suggestionBoxes).forEach(box => {
            if (box && document.body.contains(box)) {
                box.remove();
            }
        });
        
        // Clear all overlays
        document.querySelectorAll('.route-box-overlay').forEach(overlay => {
            overlay.remove();
        });
        
        // Clean up all input listeners
        Object.keys(this.inputStates).forEach(inputId => {
            this.cleanupInputListeners(inputId);
        });
        
        // Reset state
        this.suggestionBoxes = {};
        this.inputStates = {};
        this.debounceTimers = {};
    }
}

// Create singleton instance
const inputManager = new InputManager();

export { inputManager };

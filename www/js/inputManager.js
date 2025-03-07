import { appState, updateState } from './stateManager.js';
import { map } from './map.js';
import { fetchAirportByIata, updateSuggestions } from './airportAutocomplete.js';

class InputManager {
    constructor() {
        this.debounceTimers = {};
        this.suggestionBoxes = {};
        this.inputStates = {};
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
        
        // Set necessary attributes
        inputField.setAttribute('autocomplete', 'new-password');
        inputField.setAttribute('name', `waypoint-input-${Date.now()}`);
        inputField.setAttribute('role', 'combobox');
        inputField.setAttribute('aria-autocomplete', 'list');
        inputField.setAttribute('aria-expanded', 'false');
        
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
        
        inputState.previousValidValue = inputField.value;
        inputState.previousIataCode = inputField.getAttribute('data-selected-iata');
        
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
          updateSuggestions(inputId, []);
          // After updating suggestions, position the box again
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
        
        setTimeout(() => {
            if (suggestionBox) suggestionBox.style.display = 'none';
            
            inputField.setAttribute('readonly', true);
            
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
            
            inputState.isProcessingBlur = false;
        }, 300);
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
                    const inputNumber = parseInt(inputId.replace(/\D/g, ''), 10);
                    const isOriginField = (inputNumber - 1) % 2 === 0;
                    
                    if (isOriginField) {
                        const destId = `waypoint-input-${inputNumber + 1}`;
                        const destField = document.getElementById(destId);
                        
                        if (destField && !destField.value.trim()) {
                            requestAnimationFrame(() => destField.focus());
                            return;
                        }
                    }
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
            updateState('removeWaypoint', waypointIndex, 'inputManager.backButton');
            
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
    
    syncInputWithWaypoint(inputId) {
        const inputField = document.getElementById(inputId);
        if (!inputField) return;
        
        const waypointIndex = parseInt(inputId.replace(/\D/g, ''), 10) - 1;
        const waypoint = appState.waypoints[waypointIndex];
        
        if (!waypoint) {
            inputField.value = '';
            inputField.removeAttribute('data-selected-iata');
            inputField.removeAttribute('data-is-any-destination');
            
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
            
            if (this.inputStates[inputId]) {
                this.inputStates[inputId].previousValidValue = 'Anywhere';
                this.inputStates[inputId].previousIataCode = 'Any';
            }
        } else {
            inputField.value = `${waypoint.city}, (${waypoint.iata_code})`;
            inputField.setAttribute('data-selected-iata', waypoint.iata_code);
            inputField.removeAttribute('data-is-any-destination');
            
            if (this.inputStates[inputId]) {
                this.inputStates[inputId].previousValidValue = inputField.value;
                this.inputStates[inputId].previousIataCode = waypoint.iata_code;
            }
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
    
    cleanup() {
        Object.values(this.suggestionBoxes).forEach(box => {
            if (box && document.body.contains(box)) {
                box.remove();
            }
        });
        
        document.querySelectorAll('.route-box-overlay').forEach(overlay => {
            overlay.remove();
        });
        
        Object.keys(this.inputStates).forEach(inputId => {
            this.cleanupInputListeners(inputId);
        });
        
        this.suggestionBoxes = {};
        this.inputStates = {};
        this.debounceTimers = {};
    }
}

const inputManager = new InputManager();

export { inputManager };

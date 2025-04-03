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
        return this.inputStates[inputId] ??= {
            isInitialFocus: true,
            isExpanded: false, 
            isProcessingBlur: false,
            hasSuggestions: false,
            selectedIata: null,
            isAnyDestination: false,
            selectedSuggestionIndex: -1,
            previousValidValue: '',
            previousIataCode: null
        };
    }

    setupWaypointInput(inputId, options = {}) {
        const inputField = document.getElementById(inputId);
        if (!inputField) return null;

        const waypointIndex = parseInt(inputId.replace(/\D/g, ''), 10) - 1;
        const isOriginField = waypointIndex % 2 === 0;
        const inputState = this.initInputState(inputId);
        
        this.cleanupInputListeners(inputId);
        
        const originalPlaceholder = inputField.getAttribute('placeholder') || 
            (isOriginField ? 'From' : 'Where to?');
        
        Object.assign(inputField, {
            autocomplete: 'new-password',
            name: `waypoint-input-${Date.now()}`,
            role: 'combobox',
            'aria-autocomplete': 'list',
            'aria-expanded': 'false',
            placeholder: originalPlaceholder
        });
        
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
        
        inputField.addEventListener('airportSelected', (event) => {
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
            this.positionSuggestionBox(inputId);
            if (suggestionBox.children.length > 0) suggestionBox.style.display = 'block';
        }
        
        requestAnimationFrame(() => inputField.select());
        
        if (suggestionBox && this.isMobile() && !suggestionBox._hasTouchListener) {
            suggestionBox.addEventListener('touchstart', (e) => {
                if (e.target !== suggestionBox) e.preventDefault();
            }, { passive: false });
            suggestionBox._hasTouchListener = true;
        }
        
        const iataCode = inputField.getAttribute('data-selected-iata');
        if (iataCode && iataCode !== 'Any' && !appState.preventMapViewChange) {
            fetchAirportByIata(iataCode)
                .then(airport => {
                    if (airport?.latitude && airport?.longitude) {
                        map.flyTo([airport.latitude, airport.longitude], 6, { animate: true, duration: 0.5 });
                    }
                })
                .catch(error => console.warn('Error flying to airport:', error));
        }

        if (!inputField.value.trim()) {
            const waypointIndex = parseInt(inputId.replace(/\D/g, ''), 10) - 1;
            const routeNumber = Math.floor(waypointIndex / 2);
            const isOrigin = waypointIndex % 2 === 0;
            
            if (!isOrigin && appState.routeData[routeNumber]?.origin) {
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
                inputField.toggleAttribute('data-is-any-destination', inputState.previousValidValue === 'Anywhere');
            } else {
                inputField.value = '';
                inputField.removeAttribute('data-selected-iata');
                inputField.removeAttribute('data-is-any-destination');
            }
        }
        
        const finalValue = inputField.value;
        const isAnyDestination = finalValue === 'Anywhere' || 
                                 inputField.getAttribute('data-is-any-destination') === 'true';
            
        if (this.isMobile() && inputState.isExpanded) {
            this.revertInput(inputId);
            inputState.isExpanded = false;
        }

        if (suggestionBox) suggestionBox.style.display = 'none';
        inputField.readOnly = Boolean(finalValue.trim());
        
        if (!isAnyDestination && !window.preserveAnyDestination && 
            finalValue === '' && !appState.isRouteSwitching && !appState.searchResultsLoading) {
            
            const waypointIndex = parseInt(inputId.replace(/\D/g, ''), 10) - 1;
            const routeNumber = Math.floor(waypointIndex / 2);
            const isOrigin = waypointIndex % 2 === 0;
            
            const route = appState.routeData[routeNumber];
            const waypoint = isOrigin ? route?.origin : route?.destination;
            
            if (route && waypoint && waypoint.iata_code !== 'Any') {
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
                if (!this.isMobile()) this.focusPairedInputField(inputId);
                else event.target.blur();
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
                    if (!this.isMobile()) this.focusPairedInputField(inputId);
                    else inputField.blur();
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
        if (inputField) inputField.setAttribute('aria-activedescendant', selectedItem.id || '');
    }
    
    handleInput(inputId) {
        if (this.inputStates[inputId]) this.inputStates[inputId].selectedSuggestionIndex = -1;
    }

    positionSuggestionBox(inputId) {
        const input = document.getElementById(inputId);
        const suggestionBox = this.suggestionBoxes[inputId];
        
        if (!input || !suggestionBox) return;
        
        const rect = input.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) {
            suggestionBox.style.display = 'none';
            return;
        }
        
        const width = Math.max(rect.width, 200);
        const spaceAbove = rect.top;
        const spaceBelow = window.innerHeight - rect.bottom;
        let boxHeight = suggestionBox.offsetHeight || 
                        (suggestionBox.children.length > 0 ? suggestionBox.children.length * 36 : 200);
        
        Object.assign(suggestionBox.style, {
            position: 'fixed',
            left: `${rect.left}px`,
            width: `${width}px`,
            zIndex: '10000'
        });
        
        if (spaceAbove >= boxHeight || spaceAbove >= spaceBelow) {
            suggestionBox.style.top = `${rect.top - boxHeight}px`;
            suggestionBox.style.bottom = 'auto';
            suggestionBox.classList.add('suggestions-above');
            suggestionBox.classList.remove('suggestions-below');
        } else {
            suggestionBox.style.top = `${rect.bottom}px`;
            suggestionBox.style.bottom = 'auto';
            suggestionBox.classList.add('suggestions-below');
            suggestionBox.classList.remove('suggestions-above');
        }
        
        if (this.inputStates[inputId]?.showSuggestions && 
            this.inputStates[inputId]?.suggestions?.length > 0) {
            suggestionBox.style.display = 'block';
        }
    }

    repositionAllSuggestionBoxes() {
        const inputIds = [...Object.keys(this.suggestionBoxes)];
        
        inputIds.forEach(id => {
            const input = document.getElementById(id);
            
            if (!input || !document.body.contains(input)) {
                const box = this.suggestionBoxes[id];
                if (box && document.body.contains(box)) {
                    box.remove();
                }
                delete this.suggestionBoxes[id];
                delete this.inputStates[id];
            }
        });
        
        Object.keys(this.suggestionBoxes).forEach(id => {
            const input = document.getElementById(id);
            if (input && document.body.contains(input)) {
                this.positionSuggestionBox(id);
            }
        });
    }

    recreateSuggestionBoxes() {
        Object.keys(this.suggestionBoxes).forEach(id => {
            const box = this.suggestionBoxes[id];
            if (box && document.body.contains(box)) {
                box.remove();
            }
        });
        
        this.suggestionBoxes = {};
        
        const waypointInputs = document.querySelectorAll('.waypoint-input[type="text"]');
        
        waypointInputs.forEach(input => {
            if (input.id && document.body.contains(input)) {
                this.ensureSuggestionBox(input.id);
                this.positionSuggestionBox(input.id);
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
            
            updateState('updateRouteData', {
                routeNumber,
                data: { [isOrigin ? 'origin' : 'destination']: null }
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
                if (document.body.contains(overlay)) overlay.remove();
            }, 300);
        }
        
        inputField.classList.remove('expanded-input');
        
        if (suggestionBox) {
            suggestionBox.classList.remove('expanded-suggestions');
            suggestionBox.style.display = 'none';
        }
        
        const backButton = inputField.parentElement?.querySelector('.back-button');
        if (backButton) backButton.remove();
    }
    
    createMobileOverlay() {
        const existingOverlay = document.querySelector('.route-box-overlay');
        if (existingOverlay) existingOverlay.remove();
        
        if (appState.searchResultsLoading) return;
        
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
            
            if (document.activeElement?.tagName === 'INPUT') {
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
            if (overlay && document.body.contains(overlay)) overlay.classList.add('active');
        });
    }
    
    syncInputWithWaypoint(inputId) {
        const inputField = document.getElementById(inputId);
        if (!inputField) return;
        
        const routeNumber = parseInt(inputId.replace(/\D/g, ''), 10) - 1;
        const isOrigin = routeNumber % 2 === 0;
        const route = appState.routeData[Math.floor(routeNumber / 2)];
        if (!route) return;
        
        const waypoint = isOrigin ? route.origin : route.destination;
        
        if (waypoint) {
            if (waypoint.iata_code === 'Any') {
                inputField.value = 'Anywhere';
                inputField.setAttribute('data-selected-iata', 'Any');
                inputField.setAttribute('data-is-any-destination', 'true');
            } else if (waypoint.iata_code) {
                inputField.value = `${waypoint.city || waypoint.name || waypoint.iata_code}, (${waypoint.iata_code})`;
                inputField.setAttribute('data-selected-iata', waypoint.iata_code);
                inputField.removeAttribute('data-is-any-destination');
            } else {
                inputField.value = '';
                inputField.readOnly = false;
                return;
            }
            inputField.readOnly = true;
        } else {
            inputField.value = '';
            inputField.readOnly = false;
        }
    }
    
    isMobile() {
        return window.innerWidth <= 600;
    }
    
    setFocusToNextUnsetInput() {
        if (this.isMobile()) return;
        requestAnimationFrame(() => {
            const inputs = document.querySelectorAll('.waypoint-input[type="text"]');
            for (let input of inputs) {
                if (!input.value) {
                    input.focus();
                    break;
                }
            }
        });
    }
    
    cleanupInput(inputId) {
        if (this.suggestionBoxes[inputId]) {
            const box = this.suggestionBoxes[inputId];
            if (box && document.body.contains(box)) box.remove();
            delete this.suggestionBoxes[inputId];
        }
        
        this.cleanupInputListeners(inputId);
        delete this.inputStates[inputId];
        delete this.debounceTimers[`autocomplete-${inputId}`];
        delete this.debounceTimers[`input-${inputId}`];
    }
    
    cleanupAll() {
        Object.keys(this.suggestionBoxes).forEach(inputId => this.cleanupInput(inputId));
        document.querySelectorAll('.suggestions').forEach(box => {
            if (box.id?.includes('Suggestions')) box.remove();
        });
        
        this.suggestionBoxes = {};
        this.inputStates = {};
        this.debounceTimers = {};
    }
    
    cleanup() {
        this.resizeObservers.forEach(observer => observer.disconnect());
        this.resizeObservers = [];
        
        if (this.mutationObserver) {
            this.mutationObserver.disconnect();
            this.mutationObserver = null;
        }
        
        Object.values(this.suggestionBoxes).forEach(box => {
            if (box && document.body.contains(box)) box.remove();
        });
        
        this.suggestionBoxes = {};
        this.inputStates = {};
        
        Object.keys(this.inputStates).forEach(inputId => this.cleanupInputListeners(inputId));
        document.querySelectorAll('.route-box-overlay').forEach(overlay => overlay.remove());
    }

    focusPairedInputField(inputId) {
        if (this.isMobile()) return;
        
        const inputNumber = parseInt(inputId.replace(/\D/g, ''), 10);
        const waypointIndex = inputNumber - 1;
        const isOriginField = waypointIndex % 2 === 0;
        
        if (isOriginField) {
            const destField = document.getElementById(`waypoint-input-${inputNumber + 1}`);
            if (destField && !destField.value.trim()) {
                requestAnimationFrame(() => destField.focus());
            }
        } else {
            const routeNumber = Math.floor(waypointIndex / 2);
            const nextRouteNumber = routeNumber + 1;
            
            const currentRoute = appState.routeData[routeNumber];
            if (currentRoute?.origin && currentRoute?.destination) {
                const nextRouteExists = appState.routeData[nextRouteNumber] && 
                    (appState.routeData[nextRouteNumber].origin || appState.routeData[nextRouteNumber].destination);
                
                if (!nextRouteExists) {
                    const nextOriginField = document.getElementById(`waypoint-input-${(nextRouteNumber * 2) + 1}`);
                    if (nextOriginField) requestAnimationFrame(() => nextOriginField.focus());
                }
            }
        }
    }

    handleAirportSelection(inputId, airport) {
        if (!airport) return;
        
        const waypointIndex = parseInt(inputId.replace(/\D/g, ''), 10) - 1;
        const routeNumber = Math.floor(waypointIndex / 2);
        const isOrigin = waypointIndex % 2 === 0;
        
        if (!appState.routeData[routeNumber]) {
            appState.routeData[routeNumber] = {
                tripType: 'oneWay',
                travelers: 1,
                departDate: null,
                returnDate: null
            };
        }
        
        updateState('updateRouteData', {
            routeNumber,
            data: { [isOrigin ? 'origin' : 'destination']: airport }
        }, 'inputManager.handleAirportSelection');
        
        if (this.isMobile()) return;
        
        const pairIndex = isOrigin ? waypointIndex + 1 : waypointIndex - 1;
        const pairFieldId = `waypoint-input-${pairIndex + 1}`;
        const pairField = document.getElementById(pairFieldId);
        
        if (isOrigin && pairField) {
            const pairValue = pairField.value.trim();
            const isAnyDestination = pairField.getAttribute('data-is-any-destination') === 'true';
            const iataCode = pairField.getAttribute('data-selected-iata');
            const isAnywhere = pairValue === 'Anywhere' || isAnyDestination || iataCode === 'Any';
            const hasValidDestination = pairValue !== '' && !isAnywhere;
            
            if (!hasValidDestination) {
                if (isAnywhere && airport.iata_code !== 'Any') {
                    pairField.value = '';
                    pairField.removeAttribute('data-selected-iata');
                    pairField.removeAttribute('data-is-any-destination');
                    pairField.readOnly = false;
                    
                    const route = appState.routeData[routeNumber];
                    if (route) route.destination = null;
                }
                
                const routeData = appState.routeData[routeNumber];
                if (routeData?.origin && routeData.origin.iata_code !== 'Any') {
                    routeData._destinationNeedsEmptyFocus = true;
                }
                
                pairField.focus();
                import('./airportAutocomplete.js').then(module => module.updateSuggestions(pairFieldId, []));
            }
        } else if (!isOrigin && pairField) {
            const pairValue = pairField.value.trim();
            const isAnyOrigin = pairField.getAttribute('data-is-any-destination') === 'true';
            const iataCode = pairField.getAttribute('data-selected-iata');
            const isAnywhere = pairValue === 'Anywhere' || isAnyOrigin || iataCode === 'Any';
            const hasValidOrigin = pairValue !== '' && !isAnywhere;
            
            if (!hasValidOrigin) {
                if (isAnywhere && airport.iata_code !== 'Any') {
                    pairField.value = '';
                    pairField.removeAttribute('data-selected-iata');
                    pairField.removeAttribute('data-is-any-destination');
                    pairField.readOnly = false;
                    
                    const route = appState.routeData[routeNumber];
                    if (route) route.origin = null;
                }
                
                const routeData = appState.routeData[routeNumber];
                if (routeData?.destination && routeData.destination.iata_code !== 'Any') {
                    routeData._originNeedsEmptyFocus = true;
                }
                
                pairField.focus();
                import('./airportAutocomplete.js').then(module => module.updateSuggestions(pairFieldId, []));
                return;
            }
            
            const nextRouteNumber = routeNumber + 1;
            const nextOriginId = `waypoint-input-${(nextRouteNumber * 2) + 1}`;
            const nextOriginField = document.getElementById(nextOriginId);
            
            const currentRoute = appState.routeData[routeNumber];
            const nextRouteExists = appState.routeData[nextRouteNumber] && 
                (appState.routeData[nextRouteNumber].origin || appState.routeData[nextRouteNumber].destination);
            
            if (currentRoute?.origin && currentRoute?.destination && !nextRouteExists && nextOriginField) {
                nextOriginField.focus();
            }
        }
    }

    init() {
        this.cleanup();
        
        window.addEventListener('resize', () => this.repositionAllSuggestionBoxes());
        window.addEventListener('scroll', () => this.repositionAllSuggestionBoxes());
        
        this.setupResizeObservers();
        this.setupMutationObserver();
    }
    
    setupResizeObservers() {
        const infoPaneElement = document.getElementById('infoPane');
        if (infoPaneElement && window.ResizeObserver) {
            const observer = new ResizeObserver(() => this.repositionAllSuggestionBoxes());
            observer.observe(infoPaneElement);
            this.resizeObservers.push(observer);
        }
        
        const resizeHandle = document.getElementById('resizeHandle');
        if (resizeHandle) {
            resizeHandle.addEventListener('mousedown', () => {
                const dragInterval = setInterval(() => this.repositionAllSuggestionBoxes(), 10);
                const stopDragging = () => {
                    clearInterval(dragInterval);
                    document.removeEventListener('mouseup', stopDragging);
                    this.repositionAllSuggestionBoxes();
                };
                document.addEventListener('mouseup', stopDragging);
            });
        }
        
        if (infoPaneElement) {
            infoPaneElement.addEventListener('transitionend', () => this.repositionAllSuggestionBoxes());
        }
    }
    
    setupMutationObserver() {
        if (this.mutationObserver) this.mutationObserver.disconnect();
        
        this.mutationObserver = new MutationObserver((mutations) => {
            let domStructureChanged = false;
            let needsRepositioning = false;
            
            for (const mutation of mutations) {
                if (mutation.type === 'childList' && 
                   (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0)) {
                    
                    if (mutation.removedNodes.length > 0) {
                        for (const node of mutation.removedNodes) {
                            if (node.nodeType === Node.ELEMENT_NODE) {
                                if (node.tagName === 'INPUT' || 
                                    node.classList?.contains('input-wrapper') ||
                                    node.querySelector('input')) {
                                    domStructureChanged = true;
                                    break;
                                }
                            }
                        }
                    }
                    
                    if (!domStructureChanged && mutation.addedNodes.length > 0) {
                        for (const node of mutation.addedNodes) {
                            if (node.nodeType === Node.ELEMENT_NODE) {
                                if (node.tagName === 'INPUT' || 
                                    node.classList?.contains('input-wrapper') ||
                                    node.querySelector('input')) {
                                    domStructureChanged = true;
                                    break;
                                }
                            }
                        }
                    }
                }
                
                if (!domStructureChanged && mutation.type === 'attributes' && 
                   (mutation.attributeName === 'style' || mutation.attributeName === 'class')) {
                    if (mutation.target.id === 'infoPane' ||
                        mutation.target.classList?.contains('route-box') ||
                        mutation.target.classList?.contains('input-wrapper')) {
                        needsRepositioning = true;
                    }
                }
            }
            
            if (domStructureChanged) {
                console.log('Major DOM structure change detected - recreating suggestion boxes');
                this.recreateSuggestionBoxes();
            } 
            else if (needsRepositioning) {
                this.repositionAllSuggestionBoxes();
            }
        });
        
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

document.addEventListener('DOMContentLoaded', () => inputManager.init());

export { inputManager };

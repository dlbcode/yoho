import { appState, updateState } from './stateManager.js';
import { map } from './map.js';
import { inputManager } from './inputManager.js';

// Core utility functions
const getWaypointIndex = (inputId) => parseInt(inputId.replace(/\D/g, ''), 10) - 1;
const isOriginField = (waypointIndex) => waypointIndex % 2 === 0;
const getPairIndex = (waypointIndex, isOrigin) => isOrigin ? waypointIndex + 1 : waypointIndex - 1;
const getRouteNumber = (waypointIndex) => Math.floor(waypointIndex / 2);

const getOrCreateRouteData = (routeNumber) => {
    let routeData = appState.routeData[routeNumber];
    if (!routeData) {
        routeData = {
            tripType: 'oneWay',
            travelers: 1,
            departDate: null,
            returnDate: null
        };
        appState.routeData[routeNumber] = routeData;
    }
    return routeData;
};

const removeDuplicateSuggestionBoxes = (selector) => {
    const boxes = document.querySelectorAll(selector);
    if (boxes.length > 1) {
        const mainBox = Array.from(boxes).find(box =>
            box.hasAttribute('role') && box.style.position === 'fixed'
        ) || boxes[0];
        boxes.forEach(box => {
            if (box !== mainBox) box.remove();
        });
    }
};

// Simplified API functions with shared fetch logic
const fetchAirportsBase = async (params) => {
    try {
        const queryString = Object.entries(params)
            .map(([key, value]) => `${key}=${encodeURIComponent(value.trim())}`)
            .join('&');
        
        const response = await fetch(`https://yonderhop.com/api/airports?${queryString}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.warn('Error fetching airports:', error);
        return [];
    }
};

export const fetchAirports = async (query) => {
    if (!query || query.length < 2) return [];
    return fetchAirportsBase({ query });
};

export const fetchAirportByIata = async (iata) => {
    if (!iata) return null;
    try {
        const airports = await fetchAirportsBase({ iata });
        return airports.length > 0 ? airports[0] : null;
    } catch (error) {
        console.error('Failed to fetch airport data:', error);
        return null;
    }
};

export const getIataFromField = (inputId) => {
    const fieldValue = document.getElementById(inputId)?.value || '';
    const iataCodeMatch = fieldValue.match(/\b([A-Z]{3})\b/);
    return iataCodeMatch ? iataCodeMatch[1] : null;
};

// Consolidated function for handling suggestion selection
const handleSuggestionSelection = (inputId, suggestion) => {
    const inputField = document.getElementById(inputId);
    if (!inputField) return;
    
    const isAnywhereOption = suggestion.getAttribute('data-is-anywhere') === 'true';
    const waypointIndex = getWaypointIndex(inputId);
    const routeNumber = getRouteNumber(waypointIndex);
    const routeData = getOrCreateRouteData(routeNumber);
    const isOrigin = isOriginField(waypointIndex);
    
    const pairIndex = getPairIndex(waypointIndex, isOrigin);
    const pairField = document.getElementById(`waypoint-input-${pairIndex + 1}`);
    const pairWaypointType = isOrigin ? 'destination' : 'origin';
    
    if (isAnywhereOption) {
        const isPairAny = pairField && 
            (pairField.value === 'Anywhere' || 
             pairField.getAttribute('data-is-any-destination') === 'true' || 
             pairField.getAttribute('data-selected-iata') === 'Any') ||
            routeData[pairWaypointType]?.iata_code === 'Any';
        
        if (isOrigin && isPairAny && !window.isLoadingFromUrl) {
            alert("Both origin and destination cannot be set to 'Anywhere'");
            return;
        }
        
        const anyDestination = {
            iata_code: 'Any',
            city: 'Anywhere',
            country: '',
            name: isOrigin ? 'Any Origin' : 'Any Destination',
            isAnyDestination: !isOrigin,
            isAnyOrigin: isOrigin,
        };

        inputField.value = 'Anywhere';
        inputField.setAttribute('data-selected-iata', 'Any');
        inputField.setAttribute('data-is-any-destination', 'true');
        inputField.readOnly = true;

        if (inputManager.inputStates[inputId]) {
            inputManager.inputStates[inputId].previousValidValue = 'Anywhere';
            inputManager.inputStates[inputId].previousIataCode = 'Any';
        }

        if (pairField) {
            pairField.setAttribute('data-paired-with-anywhere', 'true');
        }

        if (isOrigin) {
            routeData.origin = anyDestination;
        } else {
            routeData.destination = anyDestination;
        }
        
        updateState('updateWaypoint', { 
            index: waypointIndex, 
            data: anyDestination 
        }, 'airportAutocomplete.anywhereSelection');

        inputField.dispatchEvent(new CustomEvent('airportSelected', {
            detail: { airport: anyDestination }
        }));
        
        setTimeout(() => {
            inputField.blur();
        }, 100);
    } else {
        const airport = suggestion._airport;
        if (!airport) return;
        
        inputField.value = `${airport.city}, (${airport.iata_code})`;
        airport.isAnyDestination = false;
        airport.isAnyOrigin = false;
        inputField.setAttribute('data-selected-iata', airport.iata_code);
        inputField.removeAttribute('data-is-any-destination');
        inputField.removeAttribute('data-paired-with-anywhere');
        inputField.readOnly = true;
        
        if (inputManager.inputStates[inputId]) {
            inputManager.inputStates[inputId].previousValidValue = inputField.value;
            inputManager.inputStates[inputId].previousIataCode = airport.iata_code;
        }
        
        if (isOrigin) {
            routeData.origin = airport;
        } else {
            routeData.destination = airport;
        }
        
        updateState('updateWaypoint', { 
            index: waypointIndex, 
            data: airport 
        }, 'airportAutocomplete.airportSelection');
        
        inputField.dispatchEvent(new CustomEvent('airportSelected', {
            detail: { airport }
        }));
        
        document.dispatchEvent(new CustomEvent('airportSelected', { 
            detail: { airport, fieldId: inputId, eventFromField: true } 
        }));
        
        setTimeout(() => {
            inputField.blur();
        }, 100);
    }
    
    const suggestionBox = document.getElementById(`${inputId}Suggestions`);
    if (suggestionBox) suggestionBox.style.display = 'none';
};

// Update suggestions in the suggestion box
export const updateSuggestions = (inputId, airports) => {
    removeDuplicateSuggestionBoxes(`div[id="${inputId}Suggestions"]`);

    const suggestionBox = document.getElementById(`${inputId}Suggestions`);
    if (!suggestionBox) return;

    suggestionBox.innerHTML = '';
    if (inputManager.inputStates[inputId]) {
        inputManager.inputStates[inputId].selectedSuggestionIndex = -1;
    }
    
    if (suggestionBox.parentElement !== document.body) {
        document.body.appendChild(suggestionBox);
    }
    
    if (!suggestionBox.hasAttribute('role')) {
        suggestionBox.setAttribute('role', 'listbox');
    }
    
    if (!suggestionBox.classList.contains('suggestions-above')) {
        suggestionBox.classList.add('suggestions-above');
    }

    const waypointIndex = getWaypointIndex(inputId);
    const isOrigin = isOriginField(waypointIndex);
    const routeNumber = getRouteNumber(waypointIndex);
    const pairIndex = getPairIndex(waypointIndex, isOrigin);
    const pairField = document.getElementById(`waypoint-input-${pairIndex + 1}`);
    const routeData = appState.routeData[routeNumber];
    const pairWaypointType = isOrigin ? 'destination' : 'origin';
    const isPairAny = pairField && 
        (pairField.value === 'Anywhere' ||
         pairField.getAttribute('data-is-any-destination') === 'true' ||
         pairField.getAttribute('data-selected-iata') === 'Any') ||
        (routeData && routeData[pairWaypointType]?.iata_code === 'Any');
    
    const inputField = document.getElementById(inputId);
    let hasAddedSuggestions = false;

    const emptyInputWithFocus = 
        inputField && 
        document.activeElement === inputField && 
        !inputField.value.trim();
    
    const isDestWithOrigin = 
        !isOrigin && 
        !inputField.value.trim() && 
        routeData && 
        routeData.origin && 
        (document.activeElement === inputField || routeData._destinationNeedsEmptyFocus);
    
    const isOriginWithDest = 
        isOrigin && 
        !inputField.value.trim() && 
        routeData && 
        routeData.destination && 
        (document.activeElement === inputField || routeData._originNeedsEmptyFocus);
    
    if (routeData) {
        if (routeData._destinationNeedsEmptyFocus) {
            delete routeData._destinationNeedsEmptyFocus;
        }
        if (routeData._originNeedsEmptyFocus) {
            delete routeData._originNeedsEmptyFocus;
        }
    }

    const showAnywhereOption = 
        (emptyInputWithFocus || isDestWithOrigin || isOriginWithDest || 
         (airports.length === 0 && inputField && inputField.value.trim() === '')) && 
        !isPairAny;
        
    if (showAnywhereOption) {
        const anywhereDiv = document.createElement('div');
        anywhereDiv.className = 'anywhere-suggestion selected';
        anywhereDiv.textContent = 'Anywhere';
        anywhereDiv.setAttribute('data-is-anywhere', 'true');
        anywhereDiv.setAttribute('role', 'option');
        anywhereDiv.id = `${inputId}-anywhere-option`;
        
        suggestionBox.appendChild(anywhereDiv);
        hasAddedSuggestions = true;
        
        if (inputManager.inputStates[inputId]) {
            inputManager.inputStates[inputId].selectedSuggestionIndex = 0;
        }
        
        suggestionBox.style.display = 'block';
        inputManager.positionSuggestionBox(inputId);
    }

    airports.forEach((airport, index) => {
        const div = document.createElement('div');
        div.textContent = `${airport.name} (${airport.iata_code}) - ${airport.city}, ${airport.country}`;
        div.setAttribute('role', 'option');
        div.id = `${inputId}-suggestion-${index}`;
        div.setAttribute('data-index', index);
        div._airport = airport;
        
        if (index === 0 && !hasAddedSuggestions) {
            div.classList.add('selected');
            hasAddedSuggestions = true;
            
            if (inputManager.inputStates[inputId]) {
                inputManager.inputStates[inputId].selectedSuggestionIndex = 0;
            }
        }
        
        suggestionBox.appendChild(div);
    });

    if (!suggestionBox._hasEventListeners) {
        const handleSuggestionInteraction = function(e) {
            if (e.type.startsWith('touch') && e.cancelable) {
                e.preventDefault();
            }
            
            const suggestion = e.target.closest('div');
            if (!suggestion) return;
            
            if (e.type === 'mousedown' || e.type === 'touchstart') {
                Array.from(this.querySelectorAll('div')).forEach(item => item.classList.remove('selected'));
                suggestion.classList.add('selected');
                
                if (inputManager.inputStates[inputId]) {
                    inputManager.inputStates[inputId].selectedSuggestionIndex = 
                        Array.from(this.querySelectorAll('div')).indexOf(suggestion);
                }
                
                e.preventDefault();
                return;
            }
            
            if (e.type === 'click' || e.type === 'touchend') {
                e.stopPropagation();
                handleSuggestionSelection(inputId, suggestion);
                e.preventDefault();
            }
        };
        
        ['mousedown', 'click', 'touchstart', 'touchend'].forEach(eventType => {
            const options = { passive: false };
            suggestionBox.addEventListener(eventType, handleSuggestionInteraction, options);
        });
        
        suggestionBox.addEventListener('mouseover', function(e) {
            const suggestion = e.target.closest('div');
            if (!suggestion) return;
            
            Array.from(this.querySelectorAll('div')).forEach(item => item.classList.remove('selected'));
            suggestion.classList.add('selected');
            
            if (inputManager.inputStates[inputId]) {
                inputManager.inputStates[inputId].selectedSuggestionIndex = 
                    Array.from(this.querySelectorAll('div')).indexOf(suggestion);
            }
        });
        
        suggestionBox._hasEventListeners = true;
    }

    if (emptyInputWithFocus && suggestionBox.children.length > 0) {
        inputManager.positionSuggestionBox(inputId);
        suggestionBox.style.display = 'block';
    }

    inputField.setAttribute('aria-expanded', suggestionBox.children.length > 0 ? 'true' : 'false');
    suggestionBox.style.display = suggestionBox.children.length > 0 ? 'block' : 'none';
    suggestionBox.style.zIndex = '10000';
    
    inputManager.positionSuggestionBox(inputId);
};

// Setup autocomplete for a field
export const setupAutocompleteForField = (fieldId) => {
    const suggestionId = `${fieldId}Suggestions`;
    removeDuplicateSuggestionBoxes(`div[id="${suggestionId}"]`);

    const inputField = inputManager.setupWaypointInput(fieldId);
    if (!inputField) return;

    const debouncedInputHandler = inputManager.debounce(async () => {
        const query = inputField.value;
        if (query.length >= 2) {
            updateSuggestions(fieldId, await fetchAirports(query));
        } else if (query.length === 0) {
            updateSuggestions(fieldId, []);
        }
    }, 200, `autocomplete-${fieldId}`);

    inputField.removeEventListener('input', inputManager.inputStates[fieldId].handlers.input);
    inputField.addEventListener('input', (e) => {
        if (inputManager.inputStates[fieldId]) {
            inputManager.inputStates[fieldId].selectedSuggestionIndex = -1;
        }
        inputField.removeAttribute('data-paired-with-anywhere');
        inputField.readOnly = false;
        debouncedInputHandler(e);
    });

    if (!inputField.value) {
        inputField.setAttribute('data-show-anywhere-option', 'true');
    }
    
    if (inputField._hasAirportListener) {
        inputField.removeEventListener('airportSelected', inputField._airportSelectedHandler);
    }
    
    inputField._airportSelectedHandler = (event) => {
        const waypointIndex = getWaypointIndex(fieldId);
        const routeNumber = getRouteNumber(waypointIndex);
        const isOrigin = isOriginField(waypointIndex);
        const airport = event.detail.airport;

        if (isOrigin) {
            if (airport && airport.iata_code !== 'Any') {
                const destIndex = waypointIndex + 1;
                const destFieldId = `waypoint-input-${destIndex + 1}`;
                const destField = document.getElementById(destFieldId);
                
                if (destField) {
                    const isAnyDestination = destField.getAttribute('data-is-any-destination') === 'true';
                    const iataCode = destField.getAttribute('data-selected-iata');
                    
                    if (isAnyDestination || iataCode === 'Any') {
                        setTimeout(() => {
                            destField.focus();
                        }, 100);
                    }
                }
            }
        } else {
            if (airport && airport.iata_code !== 'Any') {
                const originIndex = waypointIndex - 1;
                const originFieldId = `waypoint-input-${originIndex + 1}`;
                const originField = document.getElementById(originFieldId);
                
                if (originField) {
                    const isAnyOrigin = originField.getAttribute('data-is-any-destination') === 'true';
                    const iataCode = originField.getAttribute('data-selected-iata');
                    
                    if (isAnyOrigin || iataCode === 'Any') {
                        setTimeout(() => {
                            originField.focus();
                        }, 100);
                    }
                }
            }
        }
    };
    
    inputField.addEventListener('airportSelected', inputField._airportSelectedHandler);
    inputField._hasAirportListener = true;

    setTimeout(() => {
        if (inputManager.suggestionBoxes[fieldId]) {
            inputManager.positionSuggestionBox(fieldId);
        }
    }, 0);

    return () => {
        inputManager.cleanupInputListeners(fieldId);
        if (inputField._hasAirportListener) {
            inputField.removeEventListener('airportSelected', inputField._airportSelectedHandler);
        }
    };
};

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('airportSelected', (event) => {
        const { airport, fieldId } = event.detail;
        if (!fieldId) return;
        
        const waypointIndex = getWaypointIndex(fieldId);
        const routeNumber = getRouteNumber(waypointIndex);
        const isOrigin = isOriginField(waypointIndex);
        const routeData = getOrCreateRouteData(routeNumber);
        
        if (isOrigin) {
            routeData.origin = airport;
            
            if (routeData.destination && routeData.destination.iata_code === 'Any' && 
                airport.iata_code !== 'Any') {
                routeData._destinationNeedsEmptyFocus = true;
            }
        } else {
            routeData.destination = airport;
        }
        
        updateState('updateRouteData', {
            routeNumber: routeNumber,
            data: isOrigin ? { origin: airport } : { destination: airport }
        }, 'airportAutocomplete.handleAirportSelection');
        
        if (airport?.latitude && airport?.longitude) {
            const latLng = L.latLng(airport.latitude, airport.longitude);
            const currentLatLng = map.getCenter();
            
            let targetLng = latLng.lng;
            const lngDifference = targetLng - currentLatLng.lng;
            if (lngDifference > 180) targetLng -= 360;
            else if (lngDifference < -180) targetLng += 360;
            
            map.flyTo(L.latLng(latLng.lat, targetLng), 4, { animate: true, duration: 0.5 });
        }

        if (window.innerWidth > 600) {
            inputManager.setFocusToNextUnsetInput();
        }
    });

    document.addEventListener('stateChange', (event) => {
        if (event.detail.key === 'updateRouteDate' || 
            event.detail.key === 'addWaypoint' || 
            event.detail.key === 'updateWaypoint') {
                
            const inputFields = document.querySelectorAll('.waypoint-input');
            inputFields.forEach(field => {
                if (field.id) {
                    setupAutocompleteForField(field.id);
                }
            });
        }
    });
});
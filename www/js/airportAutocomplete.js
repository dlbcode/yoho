import { appState, updateState } from './stateManager.js';
import { map } from './map.js';
import { inputManager } from './inputManager.js';

// Core utility functions
const getWaypointIndex = (inputId) => parseInt(inputId.replace(/\D/g, ''), 10) - 1;
const isOriginField = (waypointIndex) => waypointIndex % 2 === 0;
const getPairIndex = (waypointIndex, isOrigin) => isOrigin ? waypointIndex + 1 : waypointIndex - 1;
const getRouteNumber = (waypointIndex) => Math.floor(waypointIndex / 2);

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
    const isOrigin = isOriginField(waypointIndex);
    
    // Get route data for this route
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
    
    // Get pair field info
    const pairIndex = getPairIndex(waypointIndex, isOrigin);
    const pairField = document.getElementById(`waypoint-input-${pairIndex + 1}`);
    const pairWaypointType = isOrigin ? 'destination' : 'origin';
    
    // Handle "Anywhere" option or airport selection
    if (isAnywhereOption) {
        // Check if pair is also "Any" - prevent both being "Any"
        const isPairAny = pairField && 
            (pairField.value === 'Anywhere' || 
             pairField.getAttribute('data-is-any-destination') === 'true' || 
             pairField.getAttribute('data-selected-iata') === 'Any') ||
            routeData[pairWaypointType]?.iata_code === 'Any';
        
        if (isOrigin && isPairAny && !window.isLoadingFromUrl) {
            alert("Both origin and destination cannot be set to 'Anywhere'");
            return;
        }
        
        // Create "Anywhere" waypoint object
        const anyDestination = {
            iata_code: 'Any',
            city: 'Anywhere',
            country: '',
            name: isOrigin ? 'Any Origin' : 'Any Destination',
            isAnyDestination: !isOrigin,
            isAnyOrigin: isOrigin,
        };

        // Update field attributes
        inputField.value = 'Anywhere';
        inputField.setAttribute('data-selected-iata', 'Any');
        inputField.setAttribute('data-is-any-destination', 'true');
        inputField.readOnly = true;

        // Update input state if available
        if (inputManager.inputStates[inputId]) {
            inputManager.inputStates[inputId].previousValidValue = 'Anywhere';
            inputManager.inputStates[inputId].previousIataCode = 'Any';
        }

        if (pairField) {
            pairField.setAttribute('data-paired-with-anywhere', 'true');
        }

        // Update app state - both routeData and waypoints
        if (isOrigin) {
            routeData.origin = anyDestination;
        } else {
            routeData.destination = anyDestination;
        }
        
        // Also update waypoints for compatibility
        updateState('updateWaypoint', { 
            index: waypointIndex, 
            data: anyDestination 
        }, 'airportAutocomplete.anywhereSelection');

        // Handle focus for mobile/desktop
        setTimeout(() => {
            inputField.blur();
            if (window.innerWidth > 600 && pairField && !pairField.value.trim()) {
                setTimeout(() => {
                    if (!isOrigin) {
                        window.justSelectedAnywhereDestination = true;
                    }
                    pairField.focus();
                    if (!isOrigin) {
                        updateSuggestions(`waypoint-input-${pairIndex + 1}`, []);
                    }
                }, 200);
            }
        }, 100);
    } else {
        // Handle specific airport selection
        const airport = suggestion._airport;
        if (!airport) return;
        
        // Ensure we don't have isAnyDestination/isAnyOrigin flags set
        airport.isAnyDestination = false;
        airport.isAnyOrigin = false;
        
        // Update input field with airport data
        inputField.value = `${airport.city}, (${airport.iata_code})`;
        inputField.setAttribute('data-selected-iata', airport.iata_code);
        inputField.removeAttribute('data-is-any-destination');
        inputField.removeAttribute('data-paired-with-anywhere');
        inputField.readOnly = true;
        
        // Update input state if available
        if (inputManager.inputStates[inputId]) {
            inputManager.inputStates[inputId].previousValidValue = inputField.value;
            inputManager.inputStates[inputId].previousIataCode = airport.iata_code;
        }
        
        // Update route data
        if (isOrigin) {
            routeData.origin = airport;
        } else {
            routeData.destination = airport;
        }
        
        // Update waypoints for compatibility
        updateState('updateWaypoint', { 
            index: waypointIndex, 
            data: airport 
        }, 'airportAutocomplete.airportSelection');
        
        // Trigger airport selected event and blur the field
        document.dispatchEvent(new CustomEvent('airportSelected', { 
            detail: { airport, fieldId: inputId } 
        }));
        
        inputField.blur();
    }
    
    // Hide suggestions
    const suggestionBox = document.getElementById(`${inputId}Suggestions`);
    if (suggestionBox) suggestionBox.style.display = 'none';
};

// Update suggestions in the suggestion box
export const updateSuggestions = (inputId, airports) => {
    const suggestionBox = document.getElementById(`${inputId}Suggestions`);
    if (!suggestionBox) return;

    // Clear suggestions and reset state
    suggestionBox.innerHTML = '';
    if (inputManager.inputStates[inputId]) {
        inputManager.inputStates[inputId].selectedSuggestionIndex = -1;
    }
    
    // Ensure box is in document
    if (suggestionBox.parentElement !== document.body) {
        document.body.appendChild(suggestionBox);
    }

    // Determine if "Anywhere" option is needed
    const waypointIndex = getWaypointIndex(inputId);
    const isOrigin = isOriginField(waypointIndex);
    const pairIndex = getPairIndex(waypointIndex, isOrigin);
    const pairField = document.getElementById(`waypoint-input-${pairIndex + 1}`);
    
    const isPairAny = pairField && 
        (pairField.value === 'Anywhere' ||
         pairField.getAttribute('data-is-any-destination') === 'true' ||
         pairField.getAttribute('data-selected-iata') === 'Any') ||
        (appState.waypoints[pairIndex]?.iata_code === 'Any');
    
    const inputField = document.getElementById(inputId);
    let hasAddedSuggestions = false;

    // Add "Anywhere" option if appropriate
    if (airports.length === 0 && !isPairAny) {
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
    }

    // Add airport suggestions
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

    // Add event delegation if not already present
    if (!suggestionBox._hasEventListeners) {
        // Single handler for all interactions
        const handleSuggestionInteraction = function(e) {
            if (e.type.startsWith('touch') && e.cancelable) {
                e.preventDefault();
            }
            
            const suggestion = e.target.closest('div');
            if (!suggestion) return;
            
            // For mousedown/touchstart, just highlight the item
            if (e.type === 'mousedown' || e.type === 'touchstart') {
                Array.from(this.querySelectorAll('div')).forEach(item => item.classList.remove('selected'));
                suggestion.classList.add('selected');
                
                if (inputManager.inputStates[inputId]) {
                    inputManager.inputStates[inputId].selectedSuggestionIndex = 
                        Array.from(this.querySelectorAll('div')).indexOf(suggestion);
                }
                return;
            }
            
            // For click/touchend, handle selection
            if (e.type === 'click' || e.type === 'touchend') {
                if (e.type === 'touchend') e.stopPropagation();
                handleSuggestionSelection(inputId, suggestion);
            }
        };
        
        // Attach event listeners
        ['mousedown', 'click', 'touchstart', 'touchend'].forEach(eventType => {
            const options = eventType.startsWith('touch') ? { passive: false } : false;
            suggestionBox.addEventListener(eventType, handleSuggestionInteraction, options);
        });
        
        // Add hover behavior
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

    // Update UI state
    inputField.setAttribute('aria-expanded', suggestionBox.children.length > 0 ? 'true' : 'false');
    suggestionBox.style.display = suggestionBox.children.length > 0 ? 'block' : 'none';
    suggestionBox.style.zIndex = '90';
    inputManager.positionSuggestionBox(inputId);
};

// Setup autocomplete for a field
export const setupAutocompleteForField = (fieldId) => {
    const inputField = inputManager.setupWaypointInput(fieldId);
    if (!inputField) return;

    // Debounce input handling
    const debouncedInputHandler = inputManager.debounce(async () => {
        const query = inputField.value;
        if (query.length >= 2) {
            updateSuggestions(fieldId, await fetchAirports(query));
        } else if (query.length === 0) {
            updateSuggestions(fieldId, []);
        }
    }, 200, `autocomplete-${fieldId}`);

    // Override inputManager's input handler
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
    
    // Position suggestion box
    setTimeout(() => {
        if (inputManager.suggestionBoxes[fieldId]) {
            inputManager.positionSuggestionBox(fieldId);
        }
    }, 0);

    return () => inputManager.cleanupInputListeners(fieldId);
};

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Handle airport selection for updating state and UI
    document.addEventListener('airportSelected', (event) => {
        const { airport, fieldId } = event.detail;
        const waypointIndex = getWaypointIndex(fieldId);
        const routeNumber = getRouteNumber(waypointIndex);
        const isOrigin = isOriginField(waypointIndex);
        
        // Get or create route data
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
        
        // Update the appropriate field in routeData
        if (isOrigin) {
            routeData.origin = airport;
        } else {
            routeData.destination = airport;
        }
        
        // If we're setting a destination first, ensure there's an origin
        if (!isOrigin && !routeData.origin) {
            // Create an "Any" origin
            const anyOrigin = {
                iata_code: 'Any',
                city: 'Anywhere',
                country: '',
                name: 'Any Origin',
                isAnyDestination: false,
                isAnyOrigin: true,
            };
            
            routeData.origin = anyOrigin;
            
            // Also update waypoints for compatibility
            updateState('updateWaypoint', { 
                index: waypointIndex - 1, 
                data: anyOrigin 
            }, 'airportAutocomplete.anyOriginForDestination');
            
            // Update the origin input field
            const originField = document.getElementById(`waypoint-input-${waypointIndex}`);
            if (originField) {
                originField.value = 'Anywhere';
                originField.setAttribute('data-selected-iata', 'Any');
                originField.setAttribute('data-is-any-destination', 'true');
                originField.readOnly = true;
                
                // Update input state
                const originInputId = `waypoint-input-${waypointIndex}`;
                if (inputManager.inputStates[originInputId]) {
                    inputManager.inputStates[originInputId].previousValidValue = 'Anywhere';
                    inputManager.inputStates[originInputId].previousIataCode = 'Any';
                }
            }
        }

        // Update map if location data exists
        if (airport?.latitude && airport?.longitude) {
            const latLng = L.latLng(airport.latitude, airport.longitude);
            const currentLatLng = map.getCenter();
            
            // Handle date line crossing
            let targetLng = latLng.lng;
            const lngDifference = targetLng - currentLatLng.lng;
            if (lngDifference > 180) targetLng -= 360;
            else if (lngDifference < -180) targetLng += 360;
            
            map.flyTo(L.latLng(latLng.lat, targetLng), 4, { animate: true, duration: 0.5 });
        }

        // Focus next empty input field on desktop
        if (window.innerWidth > 600) {
            inputManager.setFocusToNextUnsetInput();
        }
    });

    // Set up autocomplete for new waypoints
    document.addEventListener('stateChange', (event) => {
        if (event.detail.key === 'updateRouteDate' || 
            event.detail.key === 'addWaypoint' || 
            event.detail.key === 'updateWaypoint') {
                
            // Find all input fields that need autocomplete
            const inputFields = document.querySelectorAll('.waypoint-input');
            inputFields.forEach(field => {
                if (field.id) {
                    setupAutocompleteForField(field.id);
                }
            });
        }
    });
});
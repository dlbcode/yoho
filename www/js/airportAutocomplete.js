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
    
    console.log(`Suggestion selected for ${inputId}:`, suggestion);
    
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

        // Dispatch airportSelected event for Anywhere option - make sure this is dispatched BEFORE blur
        console.log(`Dispatching airportSelected event for Anywhere option from ${inputId}`);
        inputField.dispatchEvent(new CustomEvent('airportSelected', {
            detail: { airport: anyDestination }
        }));
        
        // Use a delay before blur to ensure event handlers complete
        setTimeout(() => {
            inputField.blur();
        }, 100);
    } else {
        // Handle specific airport selection
        const airport = suggestion._airport;
        if (!airport) return;
        
        // Update input field with airport data
        inputField.value = `${airport.city}, (${airport.iata_code})`;
        airport.isAnyDestination = false;
        airport.isAnyOrigin = false;
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
        
        updateState('updateWaypoint', { 
            index: waypointIndex, 
            data: airport 
        }, 'airportAutocomplete.airportSelection');
        
        // Dispatch the airportSelected event BEFORE blur
        console.log(`Dispatching airportSelected event for airport ${airport.iata_code} from ${inputId}`);
        inputField.dispatchEvent(new CustomEvent('airportSelected', {
            detail: { airport }
        }));
        
        // Let the document-level event still fire for other listeners
        document.dispatchEvent(new CustomEvent('airportSelected', { 
            detail: { airport, fieldId: inputId, eventFromField: true } 
        }));
        
        // Use a delay before blur to ensure event handlers complete
        setTimeout(() => {
            inputField.blur();
        }, 100);
    }
    
    // Hide suggestions immediately
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
    const routeNumber = Math.floor(waypointIndex / 2);
    const pairIndex = getPairIndex(waypointIndex, isOrigin);
    const pairField = document.getElementById(`waypoint-input-${pairIndex + 1}`);
    
    // Get route data to check special conditions
    const routeData = appState.routeData[routeNumber];
    
    // Define pairWaypointType based on current field type
    const pairWaypointType = isOrigin ? 'destination' : 'origin';
    
    // Check if paired field has "Any" value
    const isPairAny = pairField && 
        (pairField.value === 'Anywhere' ||
         pairField.getAttribute('data-is-any-destination') === 'true' ||
         pairField.getAttribute('data-selected-iata') === 'Any') ||
        (routeData && routeData[pairWaypointType]?.iata_code === 'Any');
    
    const inputField = document.getElementById(inputId);
    let hasAddedSuggestions = false;

    // Handle special focus cases
    const emptyInputWithFocus = 
        inputField && 
        document.activeElement === inputField && 
        !inputField.value.trim();
    
    // Check for destination field that needs suggestions (after origin selection)
    const isDestWithOrigin = 
        !isOrigin && 
        !inputField.value.trim() && 
        routeData && 
        routeData.origin && 
        (document.activeElement === inputField || routeData._destinationNeedsEmptyFocus);
    
    // New check for origin field that needs suggestions (after destination selection)
    const isOriginWithDest = 
        isOrigin && 
        !inputField.value.trim() && 
        routeData && 
        routeData.destination && 
        (document.activeElement === inputField || routeData._originNeedsEmptyFocus);
    
    // Reset the flags after use
    if (routeData) {
        if (routeData._destinationNeedsEmptyFocus) {
            console.log('Showing suggestions for destination after origin was set');
            delete routeData._destinationNeedsEmptyFocus;
        }
        if (routeData._originNeedsEmptyFocus) {
            console.log('Showing suggestions for origin after destination was set');
            delete routeData._originNeedsEmptyFocus;
        }
    }

    // If we need to show the Anywhere option, add it
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
        
        // Make sure suggestion box is visible for empty focused field
        suggestionBox.style.display = 'block';
        inputManager.positionSuggestionBox(inputId);
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
                
                // Prevent default to avoid losing focus
                e.preventDefault();
                return;
            }
            
            // For click/touchend, handle selection
            if (e.type === 'click' || e.type === 'touchend') {
                // Both click and touchend should stop propagation to prevent conflicts
                e.stopPropagation();
                
                // Explicitly handle selection regardless of event type
                handleSuggestionSelection(inputId, suggestion);
                
                // Prevent default action to avoid navigation issues
                e.preventDefault();
            }
        };
        
        // Attach event listeners
        ['mousedown', 'click', 'touchstart', 'touchend'].forEach(eventType => {
            const options = { passive: false };  // Use non-passive for all to ensure preventDefault works
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

    // Position the suggestion box even for empty inputs when needed
    if (emptyInputWithFocus && suggestionBox.children.length > 0) {
        inputManager.positionSuggestionBox(inputId);
        suggestionBox.style.display = 'block';
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
    
    // Clear existing listeners to prevent duplicates
    if (inputField._hasAirportListener) {
        inputField.removeEventListener('airportSelected', inputField._airportSelectedHandler);
    }
    
    // Add event listener to handle completion
    inputField._airportSelectedHandler = (event) => {
        console.log(`Airport selected handler triggered for ${fieldId}`);
        
        // Check if we need to handle special cases
        const waypointIndex = getWaypointIndex(fieldId);
        const isOrigin = isOriginField(waypointIndex);
        const routeNumber = getRouteNumber(waypointIndex);
        
        if (isOrigin) {
            // If origin is set, check if destination has "Anywhere" that should be cleared
            const airport = event.detail.airport;
            if (airport && airport.iata_code !== 'Any') {
                const destIndex = waypointIndex + 1;
                const destFieldId = `waypoint-input-${destIndex + 1}`;
                const destField = document.getElementById(destFieldId);
                
                if (destField) {
                    const isAnyDestination = destField.getAttribute('data-is-any-destination') === 'true';
                    const iataCode = destField.getAttribute('data-selected-iata');
                    
                    if (isAnyDestination || iataCode === 'Any') {
                        console.log(`Origin set to real airport, clearing Any destination`);
                        setTimeout(() => {
                            // Ensure this happens after state updates
                            destField.focus();
                        }, 100);
                    }
                }
            }
        } else {
            // If destination is set, check if origin has "Anywhere" that should be cleared
            const airport = event.detail.airport;
            if (airport && airport.iata_code !== 'Any') {
                const originIndex = waypointIndex - 1;
                const originFieldId = `waypoint-input-${originIndex + 1}`;
                const originField = document.getElementById(originFieldId);
                
                if (originField) {
                    const isAnyOrigin = originField.getAttribute('data-is-any-destination') === 'true';
                    const iataCode = originField.getAttribute('data-selected-iata');
                    
                    if (isAnyOrigin || iataCode === 'Any') {
                        console.log(`Destination set to real airport, clearing Any origin`);
                        setTimeout(() => {
                            // Ensure this happens after state updates
                            originField.focus();
                        }, 100);
                    }
                }
            }
        }
    };
    
    inputField.addEventListener('airportSelected', inputField._airportSelectedHandler);
    inputField._hasAirportListener = true;

    // Position suggestion box
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
    // Handle airport selection for updating state and UI
    document.addEventListener('airportSelected', (event) => {
        const { airport, fieldId } = event.detail;
        if (!fieldId) return; // Skip if fieldId is missing
        
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
            
            // If destination is already Any, and origin is now real, mark for suggestion refresh
            if (routeData.destination && routeData.destination.iata_code === 'Any' && 
                airport.iata_code !== 'Any') {
                routeData._destinationNeedsEmptyFocus = true;
            }
        } else {
            routeData.destination = airport;
        }
        
        // Update state using only updateRouteData (remove updateWaypoint call)
        updateState('updateRouteData', {
            routeNumber: routeNumber,
            data: isOrigin ? { origin: airport } : { destination: airport }
        }, 'airportAutocomplete.handleAirportSelection');
        
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
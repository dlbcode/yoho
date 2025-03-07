import { appState, updateState } from './stateManager.js';
import { map } from './map.js';
import { inputManager } from './inputManager.js';

// Utility function for debouncing
const debounce = (func, delay) => {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func(...args), delay);
    };
};

// API functions
const fetchAirports = async (query) => {
    if (!query || query.length < 2) return [];
    try {
        const encodedQuery = encodeURIComponent(query.trim());
        const response = await fetch(`https://yonderhop.com/api/airports?query=${encodedQuery}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.warn('Error fetching airports:', error);
        return [];
    }
};

export const fetchAirportByIata = async (iata) => {
    if (!iata) return null;
    try {
        const response = await fetch(`https://yonderhop.com/api/airports?iata=${encodeURIComponent(iata.trim())}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const airports = await response.json();
        return airports.length > 0 ? airports[0] : null;
    } catch (error) {
        console.error('Failed to fetch airport data:', error);
        return null;
    }
};

// Helper functions
const getWaypointIndex = (inputId) => parseInt(inputId.replace(/\D/g, ''), 10) - 1;
const isOriginField = (waypointIndex) => waypointIndex % 2 === 0;
const getPairIndex = (waypointIndex, isOrigin) => isOrigin ? waypointIndex + 1 : waypointIndex - 1;

export const getIataFromField = (inputId) => {
    const fieldValue = document.getElementById(inputId)?.value || '';
    const iataCodeMatch = fieldValue.match(/\b([A-Z]{3})\b/);
    return iataCodeMatch ? iataCodeMatch[1] : null;
};

// Update suggestions in the suggestion box
export const updateSuggestions = (inputId, airports) => {
    const suggestionBox = document.getElementById(`${inputId}Suggestions`);
    if (!suggestionBox) return;

    // Clear existing suggestions
    suggestionBox.innerHTML = '';

    // Reset selected suggestion index
    if (inputManager.inputStates[inputId]) {
        inputManager.inputStates[inputId].selectedSuggestionIndex = -1;
    }

    // Make sure suggestion box is attached to body
    if (suggestionBox.parentElement !== document.body) {
        document.body.appendChild(suggestionBox);
    }

    // Calculate waypoint index and check if pair is "Any"
    const waypointIndex = getWaypointIndex(inputId);
    const isOrigin = isOriginField(waypointIndex);
    const pairIndex = getPairIndex(waypointIndex, isOrigin);
    const pairField = document.getElementById(`waypoint-input-${pairIndex + 1}`);
    
    const pairWaypoint = (pairIndex >= 0 && pairIndex < appState.waypoints.length) ? appState.waypoints[pairIndex] : null;
    const isPairAny = (pairField && (
        pairField.value === 'Anywhere' ||
        pairField.getAttribute('data-is-any-destination') === 'true' ||
        pairField.getAttribute('data-selected-iata') === 'Any'
    )) || (pairWaypoint && (
        pairWaypoint.iata_code === 'Any' ||
        pairWaypoint.isAnyDestination === true ||
        pairWaypoint.isAnyOrigin === true
    ));

    const inputField = document.getElementById(inputId);

    // Show "Anywhere" option if appropriate
    if (airports.length === 0 && !isPairAny) {
        const anywhereDiv = document.createElement('div');
        anywhereDiv.className = 'anywhere-suggestion';
        anywhereDiv.textContent = 'Anywhere';
        anywhereDiv.setAttribute('data-is-anywhere', 'true');
        anywhereDiv.setAttribute('role', 'option');
        anywhereDiv.id = `${inputId}-anywhere-option`;
        
        anywhereDiv.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            if (isOrigin && isPairAny && !window.isLoadingFromUrl) {
                alert("Both origin and destination cannot be set to 'Anywhere'");
                suggestionBox.style.display = 'none';
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
            suggestionBox.style.display = 'none';

            if (inputManager.inputStates[inputId]) {
                inputManager.inputStates[inputId].previousValidValue = 'Anywhere';
                inputManager.inputStates[inputId].previousIataCode = 'Any';
            }

            if (pairField) {
                pairField.setAttribute('data-paired-with-anywhere', 'true');
            }

            if (waypointIndex >= 0 && waypointIndex < appState.waypoints.length) {
                updateState('updateWaypoint', { index: waypointIndex, data: anyDestination }, 'airportAutocomplete.anywhereSelection');
            } else {
                updateState('addWaypoint', anyDestination, 'airportAutocomplete.anywhereSelection');
            }

            setTimeout(() => {
                inputField.blur();
                setTimeout(() => {
                    if (window.innerWidth > 600) {
                        const otherField = document.getElementById(`waypoint-input-${pairIndex + 1}`);
                        if (otherField && !otherField.value.trim()) {
                            if (!isOrigin) {
                                window.justSelectedAnywhereDestination = true;
                                otherField.focus();
                                updateSuggestions(`waypoint-input-${pairIndex + 1}`, []);
                            } else {
                                otherField.focus();
                            }
                        }
                    }
                }, 200);
            }, 100);
        });

        anywhereDiv.addEventListener('mouseenter', () => {
            anywhereDiv.classList.add('selected');
            if (inputManager.inputStates[inputId]) {
                inputManager.inputStates[inputId].selectedSuggestionIndex = 0;
            }
        });
        
        anywhereDiv.addEventListener('mouseleave', () => {
            anywhereDiv.classList.remove('selected');
        });

        suggestionBox.appendChild(anywhereDiv);
    }

    // Add airport options
    airports.forEach((airport, index) => {
        const div = document.createElement('div');
        div.textContent = `${airport.name} (${airport.iata_code}) - ${airport.city}, ${airport.country}`;
        div.setAttribute('role', 'option');
        div.id = `${inputId}-suggestion-${index}`;
        
        div.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            inputField.value = `${airport.city}, (${airport.iata_code})`;
            inputField.setAttribute('data-selected-iata', airport.iata_code);
            inputField.removeAttribute('data-is-any-destination');
            inputField.removeAttribute('data-paired-with-anywhere');
            
            if (inputManager.inputStates[inputId]) {
                inputManager.inputStates[inputId].previousValidValue = inputField.value;
                inputManager.inputStates[inputId].previousIataCode = airport.iata_code;
            }
            
            suggestionBox.style.display = 'none';
            document.dispatchEvent(new CustomEvent('airportSelected', { detail: { airport, fieldId: inputId } }));
            inputField.blur();
        });
        
        div.addEventListener('mouseenter', () => {
            Array.from(suggestionBox.querySelectorAll('div')).forEach(item => item.classList.remove('selected'));
            div.classList.add('selected');
            
            if (inputManager.inputStates[inputId]) {
                inputManager.inputStates[inputId].selectedSuggestionIndex = 
                    Array.from(suggestionBox.querySelectorAll('div')).indexOf(div);
            }
        });
        
        div.addEventListener('mouseleave', () => div.classList.remove('selected'));
        suggestionBox.appendChild(div);
    });

    // Final UI updates
    inputField.setAttribute('aria-expanded', suggestionBox.children.length > 0 ? 'true' : 'false');
    suggestionBox.style.display = suggestionBox.children.length > 0 ? 'block' : 'none';
    suggestionBox.style.zIndex = '90';
    inputManager.positionSuggestionBox(inputId);
};

// Setup autocomplete functionality for a given field
export const setupAutocompleteForField = (fieldId) => {
    const inputField = inputManager.setupWaypointInput(fieldId);
    if (!inputField) return;

    const debouncedInputHandler = debounce(async () => {
        const query = inputField.value;
        if (query.length >= 2) {
            updateSuggestions(fieldId, await fetchAirports(query));
        } else if (query.length === 0) {
            updateSuggestions(fieldId, []);
        }
    }, 200);

    // Override the inputManager's input handler
    inputField.removeEventListener('input', inputManager.inputStates[fieldId].handlers.input);
    inputField.addEventListener('input', (e) => {
        if (inputManager.inputStates[fieldId]) {
            inputManager.inputStates[fieldId].selectedSuggestionIndex = -1;
        }
        inputField.removeAttribute('data-paired-with-anywhere');
        debouncedInputHandler(e);
    });

    if (!inputField.value) {
        inputField.setAttribute('data-show-anywhere-option', 'true');
    }
    
    // Ensure suggestion box is properly positioned after setup
    setTimeout(() => {
        if (inputManager.suggestionBoxes[fieldId]) {
            inputManager.positionSuggestionBox(fieldId);
        }
    }, 0);

    return () => inputManager.cleanupInputListeners(fieldId);
};

document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('airportSelected', (event) => {
        const { airport, fieldId } = event.detail;
        const waypointIndex = getWaypointIndex(fieldId);

        // Update state based on selection
        if (waypointIndex >= 0 && waypointIndex < appState.waypoints.length) {
            updateState('updateWaypoint', { index: waypointIndex, data: airport }, 'airportAutocomplete.addEventListener1');
        } else {
            updateState('addWaypoint', airport, 'airportAutocomplete.addEventListener2');
        }

        // Fly to selected airport location
        if (airport && airport.latitude && airport.longitude) {
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

    // Set up autocomplete for waypoint inputs when waypoints change
    document.addEventListener('stateChange', (event) => {
        if (event.detail.key === 'waypoints') {
            event.detail.value.forEach((waypoint, index) => {
                const fieldId = `waypoint-input-${index + 1}`;
                const field = document.getElementById(fieldId);
                if (field && field.value !== "Any") {
                    setupAutocompleteForField(fieldId);
                }
            });
        }
    });
});
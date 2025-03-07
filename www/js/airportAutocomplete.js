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

// Fetch airports by query
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

// Fetch airport by IATA code
export const fetchAirportByIata = async (iata) => {
    if (!iata) return null;
    try {
        const encodedIata = encodeURIComponent(iata.trim());
        const response = await fetch(`https://yonderhop.com/api/airports?iata=${encodedIata}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const airports = await response.json();
        return airports.length > 0 ? airports[0] : null;
    } catch (error) {
        console.error('Failed to fetch airport data:', error);
        return null;
    }
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
    const waypointIndex = parseInt(inputId.replace(/\D/g, ''), 10) - 1;
    const isOriginField = waypointIndex % 2 === 0;
    const pairIndex = isOriginField ? waypointIndex + 1 : waypointIndex - 1;
    const pairField = document.getElementById(`waypoint-input-${pairIndex + 1}`);

    const pairFieldHasAnywhere = pairField && (
        pairField.value === 'Anywhere' ||
        pairField.getAttribute('data-is-any-destination') === 'true' ||
        pairField.getAttribute('data-selected-iata') === 'Any'
    );
    const pairWaypoint = (pairIndex >= 0 && pairIndex < appState.waypoints.length)
        ? appState.waypoints[pairIndex]
        : null;
    const isPairAny = pairFieldHasAnywhere ||
        (pairWaypoint && (
            pairWaypoint.iata_code === 'Any' ||
            pairWaypoint.isAnyDestination === true ||
            pairWaypoint.isAnyOrigin === true
        ));

    const inputField = document.getElementById(inputId);

    // Show "Anywhere" only if there are no airport suggestions and the pair isn't "Any"
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
            
            // Don’t allow both origin & destination to be "Anywhere"
            if (isOriginField && isPairAny && !window.isLoadingFromUrl) {
                alert("Both origin and destination cannot be set to 'Anywhere'");
                suggestionBox.style.display = 'none';
                return;
            }

            // Create waypoint data for "Any"
            const anyDestination = {
                iata_code: 'Any',
                city: 'Anywhere',
                country: '',
                name: isOriginField ? 'Any Origin' : 'Any Destination',
                isAnyDestination: !isOriginField,
                isAnyOrigin: isOriginField,
            };

            // Update input field
            inputField.value = 'Anywhere';
            inputField.setAttribute('data-selected-iata', 'Any');
            inputField.setAttribute('data-is-any-destination', 'true');
            suggestionBox.style.display = 'none';

            // Update inputManager
            if (inputManager.inputStates[inputId]) {
                inputManager.inputStates[inputId].previousValidValue = 'Anywhere';
                inputManager.inputStates[inputId].previousIataCode = 'Any';
            }

            // Flag the paired field
            if (pairField) {
                pairField.setAttribute('data-paired-with-anywhere', 'true');
            }

            // Update appState
            if (waypointIndex >= 0 && waypointIndex < appState.waypoints.length) {
                updateState('updateWaypoint', { index: waypointIndex, data: anyDestination }, 'airportAutocomplete.anywhereSelection');
            } else {
                updateState('addWaypoint', anyDestination, 'airportAutocomplete.anywhereSelection');
            }

            // Blur and optionally focus the next field
            setTimeout(() => {
                inputField.blur();
                setTimeout(() => {
                    if (window.innerWidth > 600) {
                        const otherIndex = isOriginField ? waypointIndex + 1 : waypointIndex - 1;
                        const otherField = document.getElementById(`waypoint-input-${otherIndex + 1}`);
                        if (otherField && !otherField.value.trim()) {
                            if (!isOriginField) {
                                window.justSelectedAnywhereDestination = true;
                                otherField.focus();
                                updateSuggestions(`waypoint-input-${otherIndex + 1}`, []);
                            } else {
                                otherField.focus();
                            }
                        }
                    }
                }, 200);
            }, 100);
        });

        // Hover effect for keyboard nav
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
            
            // Update input field
            inputField.value = `${airport.city}, (${airport.iata_code})`;
            inputField.setAttribute('data-selected-iata', airport.iata_code);
            inputField.removeAttribute('data-is-any-destination');
            inputField.removeAttribute('data-paired-with-anywhere');
            
            // Update previous valid values in inputManager
            if (inputManager.inputStates[inputId]) {
                inputManager.inputStates[inputId].previousValidValue = inputField.value;
                inputManager.inputStates[inputId].previousIataCode = airport.iata_code;
            }
            
            // Hide suggestion box
            suggestionBox.style.display = 'none';
            
            // Trigger airportSelected event
            document.dispatchEvent(new CustomEvent('airportSelected', { 
                detail: { airport, fieldId: inputId } 
            }));
            
            // Blur the input field
            inputField.blur();
        });
        
        // Add hover effect for keyboard navigation
        div.addEventListener('mouseenter', () => {
            // Remove selected class from all items
            Array.from(suggestionBox.querySelectorAll('div')).forEach(
                item => item.classList.remove('selected')
            );
            
            // Add selected class to this item
            div.classList.add('selected');
            
            // Update selected index
            if (inputManager.inputStates[inputId]) {
                const allOptions = Array.from(suggestionBox.querySelectorAll('div'));
                inputManager.inputStates[inputId].selectedSuggestionIndex = allOptions.indexOf(div);
            }
        });
        
        div.addEventListener('mouseleave', () => {
            div.classList.remove('selected');
        });
        
        suggestionBox.appendChild(div);
    });

    // Final UI updates
    inputField.setAttribute('aria-expanded', suggestionBox.children.length > 0 ? 'true' : 'false');
    suggestionBox.style.display = suggestionBox.children.length > 0 ? 'block' : 'none';
    suggestionBox.style.zIndex = '90';
    inputManager.positionSuggestionBox(inputId);
};

// Get IATA code from field value
export const getIataFromField = (inputId) => {
    const fieldValue = document.getElementById(inputId)?.value || '';
    const iataCodeMatch = fieldValue.match(/\b([A-Z]{3})\b/);
    return iataCodeMatch ? iataCodeMatch[1] : null;
};

// Setup autocomplete functionality for a given field
export const setupAutocompleteForField = (fieldId) => {
    // First set up the input field with the inputManager
    const inputField = inputManager.setupWaypointInput(fieldId);
    if (!inputField) return;

    // Add specific airport autocomplete functionality
    const debouncedInputHandler = debounce(async () => {
        const query = inputField.value;
        if (query.length >= 2) {
            const airports = await fetchAirports(query);
            updateSuggestions(fieldId, airports);
        } else if (query.length === 0) {
            // Show empty suggestions for focus cases
            updateSuggestions(fieldId, []);
        }
    }, 200);

    // Override the inputManager's input handler with our specific one
    inputField.removeEventListener('input', inputManager.inputStates[fieldId].handlers.input);
    inputField.addEventListener('input', (e) => {
        // Reset selection index when user types
        if (inputManager.inputStates[fieldId]) {
            inputManager.inputStates[fieldId].selectedSuggestionIndex = -1;
        }
        
        // Clear the paired-with-anywhere attribute when typing in a field
        inputField.removeAttribute('data-paired-with-anywhere');
        
        debouncedInputHandler(e);
    });

    // Add special data attribute for initial empty state
    if (!inputField.value) {
        inputField.setAttribute('data-show-anywhere-option', 'true');
    }

    // Return cleanup function for component lifecycle management
    return () => {
        inputManager.cleanupInputListeners(fieldId);
    };
};

document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('airportSelected', (event) => {
        const { airport, fieldId } = event.detail;
        const waypointIndex = parseInt(fieldId.replace(/\D/g, ''), 10) - 1;

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
            const adjustedLatLng = adjustLatLngForShortestPath(currentLatLng, latLng);
            map.flyTo(adjustedLatLng, 4, { animate: true, duration: 0.5 });
        }

        // Focus next empty input field on desktop
        if (window.innerWidth > 600) {
            inputManager.setFocusToNextUnsetInput();
        }
    });

    const adjustLatLngForShortestPath = (currentLatLng, targetLatLng) => {
        let currentLng = currentLatLng.lng;
        let targetLng = targetLatLng.lng;
        let lngDifference = targetLng - currentLng;

        // Handle date line crossing
        if (lngDifference > 180) {
            targetLng -= 360;
        } else if (lngDifference < -180) {
            targetLng += 360;
        }

        return L.latLng(targetLatLng.lat, targetLng);
    };

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
import { appState, updateState } from './stateManager.js';
import { map } from './map.js';
import { pathDrawing } from './pathDrawing.js';
import { flightMap } from './flightMap.js';

async function fetchAirports(query) {
    try {
        const response = await fetch(`https://yonderhop.com/api/airports?query=${query}`);
        return await response.json();
    } catch (error) {
        console.warn('Airport not found');
        return [];
    }
}

async function fetchAirportByIata(iata) {
    try {
        const response = await fetch(`https://yonderhop.com/api/airports?iata=${iata}`);
        const airports = await response.json();
        return airports.length > 0 ? airports[0] : null;
    } catch (error) {
        console.error('Failed to fetch airport data', error);
        return null;
    }
}

function setupAutocompleteForField(fieldId) {
    const inputField = document.getElementById(fieldId);
    const suggestionBox = document.getElementById(fieldId + 'Suggestions');
    let selectionMade = false; // Track if a selection has been made
    let initialInputValue = ""; // Store the initial input value on focus
    let currentFocus = -1; // Track the currently focused item in the suggestion box

    // Disable browser autofill
    inputField.setAttribute('autocomplete', 'new-password');
    inputField.setAttribute('name', 'waypoint-' + Date.now());
    inputField.setAttribute('readonly', true);
    inputField.addEventListener('focus', () => {
        inputField.removeAttribute('readonly');
        toggleSuggestionBox(true);
        initialInputValue = inputField.value;
    });

    inputField.addEventListener('focus', async () => {
        inputField.removeAttribute('readonly');
        toggleSuggestionBox(true);
        initialInputValue = inputField.value;

        // New functionality to center map on airport
        const iataCode = inputField.getAttribute('data-selected-iata') || getIataFromField(fieldId);
        if (iataCode) {
            const airport = await fetchAirportByIata(iataCode);
            if (airport && airport.latitude && airport.longitude) {
                map.flyTo([airport.latitude, airport.longitude], 6, {
                    animate: true,
                    duration: 0.5
                });
            }
        }
    });

    inputField.addEventListener('input', async () => {
        const airports = await fetchAirports(inputField.value);
        updateSuggestions(fieldId, airports, (value) => selectionMade = value);
        selectionMade = false;
        currentFocus = -1; // Reset the focus so item selection starts from the top
    });

    const toggleSuggestionBox = (display) => {
        suggestionBox.style.display = display ? 'block' : 'none';
        if (display) {
            const rect = inputField.getBoundingClientRect();
            suggestionBox.style.left = `${rect.left}px`;
            suggestionBox.style.top = `${rect.bottom}px`;
        }
    };

    const clearInputField = (inputField) => {
        const currentInputValue = inputField.value;
        const selectedIata = inputField.getAttribute('data-selected-iata');
        const isCurrentIataValid = currentInputValue.includes(selectedIata);
        if (!selectionMade && !isCurrentIataValid && initialInputValue !== currentInputValue) {
            inputField.value = '';
        }
    };

    const outsideClickListener = (e) => {
        if (!inputField.contains(e.target) && !suggestionBox.contains(e.target)) {
            toggleSuggestionBox(false);
            clearInputField(inputField); // Pass the correct inputField reference
        }
    };    

    // Add event listeners for focus, keydown, and blur
    inputField.addEventListener('focus', () => toggleSuggestionBox(true));
    inputField.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            toggleSuggestionBox(false);
            clearInputField();
        } else if (e.key === 'ArrowDown') {
            currentFocus++;
            updateActiveItem(suggestionBox.getElementsByTagName('div'));
        } else if (e.key === 'ArrowUp') {
            currentFocus--;
            updateActiveItem(suggestionBox.getElementsByTagName('div'));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (currentFocus > -1) {
                const items = suggestionBox.getElementsByTagName('div');
                if (items) items[currentFocus].click();
            }
        }
    });

    inputField.addEventListener('blur', () => {
        setTimeout(() => {
            clearInputField(inputField);
            toggleSuggestionBox(false);
            if (inputField.value === '' && appState.waypoints.length > 0 && appState.loadingComplete) {
                const waypointIndex = parseInt(fieldId.replace('waypoint', '')) - 1;
                if (waypointIndex < appState.waypoints.length) {
                    updateState('removeWaypoint', waypointIndex);
                }
            }
        }, 300); // Delay to allow for selection
    });

    if (!window.outsideClickListenerAdded) {
        document.addEventListener('click', outsideClickListener);
        window.outsideClickListenerAdded = true;
    }

    function updateActiveItem(items) {
        if (!items || items.length === 0) return false;
        const itemsArray = Array.from(items);
        itemsArray.forEach(item => item.classList.remove('autocomplete-active'));
        currentFocus = ((currentFocus % itemsArray.length) + itemsArray.length) % itemsArray.length;
        const activeItem = itemsArray[currentFocus];
        if (activeItem) {
            activeItem.classList.add('autocomplete-active');
            activeItem.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
                inline: 'start'
            });
        }
    }         
}

let lastFetchedAirports = [];

function updateSuggestions(inputId, airports, setSelectionMade) {
    const suggestionBox = document.getElementById(inputId + 'Suggestions');
    suggestionBox.innerHTML = '';
    lastFetchedAirports = airports;
    
    let selectionHandledByTouch = false; // Flag to track if selection was handled by touch
    
    document.querySelectorAll('.waypointTooltip').forEach(tooltip => {
        tooltip.remove(); // Remove any existing tooltips
    });
    airports.forEach(airport => {
        const div = document.createElement('div');
        div.textContent = `${airport.name} (${airport.iata_code}) - ${airport.city}, ${airport.country}`;
        let touchStartY = 0;
        let touchEndY = 0;

        function handleSelection(e) {
            if (e.type === 'click' && selectionHandledByTouch) {
                // Reset the flag and return if the selection was already handled by touchend
                selectionHandledByTouch = false;
                return;
            }
            // Proceed with selection logic for click or if it was a tap (not scroll)
            if (e.type === 'touchend' && Math.abs(touchEndY - touchStartY) < 10) {
                selectionHandledByTouch = true; // Mark that selection was handled
            }
            if (selectionHandledByTouch || e.type === 'click') {
                e.preventDefault();
                e.stopPropagation();
                
                const inputField = document.getElementById(inputId);
                inputField.value = `${airport.iata_code}`;
                suggestionBox.style.display = 'none';
                document.dispatchEvent(new CustomEvent('airportSelected', { 
                    detail: { airport, fieldId: inputId }
                }));
                inputField.setAttribute('data-selected-iata', airport.iata_code);
                setSelectionMade(true);
            }
        }
        
        div.addEventListener('touchstart', (e) => {
            touchStartY = e.touches[0].clientY;
        }, { passive: true });
        
        div.addEventListener('touchmove', (e) => {
            touchEndY = e.touches[0].clientY;
        }, { passive: true });

        div.addEventListener('touchend', handleSelection);
        div.addEventListener('click', handleSelection);
        suggestionBox.appendChild(div);
    });
    if (airports.length > 0) suggestionBox.style.display = 'block';
}

document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('airportSelected', (event) => {
        const { airport, fieldId } = event.detail;
        const waypointIndex = parseInt(fieldId.replace('waypoint', '')) - 1;
        const iata = airport.iata_code;
    
        // Check if the origin is empty and destination has a selection
        if (appState.routeDirection == 'from') {
            if (waypointIndex <= 1 && !document.getElementById('waypoint1').value) {
            updateState('routeDirection', 'to');
            }
        }

        if (appState.routeDirection == 'to') {
            if (waypointIndex <= 1 && !document.getElementById('waypoint2').value) {
            updateState('routeDirection', 'from');
            }
        }

        if (waypointIndex >= 0 && waypointIndex < appState.waypoints.length) {
            updateState('updateWaypoint', { index: waypointIndex, data: airport });
        } else {
            updateState('addWaypoint', airport);
        }
        appState.selectedAirport = airport;

        const routeNumber = Math.floor(waypointIndex / 2);

        // Calculate the index for selectedRoutes based on the routeNumber
        let selectedRouteIndex = routeNumber;
        let groupNumber = appState.selectedRoutes[selectedRouteIndex]?.group;

        // Remove all selectedRoutes with the same group number
        Object.keys(appState.selectedRoutes).forEach(key => {
            if (appState.selectedRoutes[key].group === groupNumber) {
                updateState('removeSelectedRoute', parseInt(key));
            }
        });
        
        // Move map view to include the selected airport marker
        if (airport && airport.latitude && airport.longitude) {
            const latLng = L.latLng(airport.latitude, airport.longitude);
            const currentLatLng = map.getCenter();
            const adjustedLatLng = adjustLatLngForShortestPath(currentLatLng, latLng);
            map.flyTo(adjustedLatLng, 4, {
                animate: true,
                duration: 0.5 // Duration in seconds
            });          
        }
        flightMap.fetchAndCacheRoutes(iata).then(() => {
            pathDrawing.drawRoutePaths(iata, appState.directRoutes, appState.routeDirection);
        });
    });    
    
    function adjustLatLngForShortestPath(currentLatLng, targetLatLng) {
        let currentLng = currentLatLng.lng;
        let targetLng = targetLatLng.lng;
        let lngDifference = targetLng - currentLng;
    
        // Check if crossing the antimeridian offers a shorter path
        if (lngDifference > 180) {
            targetLng -= 360;
        } else if (lngDifference < -180) {
            targetLng += 360;
        }
    
        return L.latLng(targetLatLng.lat, targetLng);
    }                                            
     
    document.addEventListener('stateChange', (event) => {
        if (event.detail.key === 'waypoints') {
            event.detail.value.forEach((_, index) => {
                setupAutocompleteForField(`waypoint${index + 1}`);
            });
        }
    });
});

export function getIataFromField(inputId) {
    const fieldValue = document.getElementById(inputId).value;
    const iataCodeMatch = fieldValue.match(/\b([A-Z]{3})\b/);
    return iataCodeMatch ? iataCodeMatch[1] : null;
}

export { setupAutocompleteForField, fetchAirportByIata }

import { appState, updateState } from './stateManager.js';
import { map } from './map.js';

async function fetchAirports(query) {
    try {
        const response = await fetch(`http://yonderhop.com:3000/airports?query=${query}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Fetch error:', error);
        return [];
    }
}

function setupAutocompleteForField(fieldId) {
    const inputField = document.getElementById(fieldId);
    const suggestionBox = document.getElementById(fieldId + 'Suggestions');
    let selectionMade = false; // Track if a selection has been made

    inputField.addEventListener('input', async () => {
        const airports = await fetchAirports(inputField.value);
        updateSuggestions(fieldId, airports, (value) => selectionMade = value);
        selectionMade = false; // Reset selection flag on new input
    });

    // Toggle suggestion box display
    const toggleSuggestionBox = (display) => {
        suggestionBox.style.display = display ? 'block' : 'none';
    };

    // Clear input field if no selection is made
    const clearInputField = () => {
        if (!selectionMade) {
            inputField.value = '';
        }
    };

    // Event listener for outside click
    const outsideClickListener = (e) => {
        if (!inputField.contains(e.target) && !suggestionBox.contains(e.target)) {
            toggleSuggestionBox(false);
            clearInputField();
        }
    };

    // Add event listeners for focus, keydown, and blur
    inputField.addEventListener('focus', () => toggleSuggestionBox(true));
    inputField.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            toggleSuggestionBox(false);
            clearInputField();
        }
    });
    
    inputField.addEventListener('blur', () => {
        setTimeout(() => {
          if (!selectionMade) {
            toggleSuggestionBox(false);
            const iataCode = getIataFromField(fieldId);
            const index = parseInt(fieldId.replace('waypoint', '')) - 1;
            if (iataCode) {
              updateState('updateWaypoint', { index, data: { iataCode } });
            } else {
              updateState('removeWaypoint', index);
            }
          }
        }, 200); // Delay to allow for selection
      });                    

    // Add outside click listener once
    if (!window.outsideClickListenerAdded) {
        document.addEventListener('click', outsideClickListener);
        window.outsideClickListenerAdded = true;
    }
}

function updateSuggestions(inputId, airports, setSelectionMade) {
    const suggestionBox = document.getElementById(inputId + 'Suggestions');
    suggestionBox.innerHTML = '';
    airports.forEach(airport => {
        const div = document.createElement('div');
        div.textContent = `${airport.name} (${airport.iata_code}) - ${airport.city}, ${airport.country}`;
        div.addEventListener('click', () => {
            const inputField = document.getElementById(inputId);
            inputField.value = `${airport.city} (${airport.iata_code})`;
            suggestionBox.style.display = 'none';
            document.dispatchEvent(new CustomEvent('airportSelected', { 
                detail: { airport, fieldId: inputId }
            }));
            setSelectionMade(true);
        });        
        suggestionBox.appendChild(div);
    });
    if (airports.length > 0) suggestionBox.style.display = 'block';
}

document.addEventListener('DOMContentLoaded', () => {
    setupAutocompleteForField('waypoint1');

    document.addEventListener('newWaypointField', (event) => {
        setupAutocompleteForField(event.detail.fieldId);
    });

    document.addEventListener('airportSelected', (event) => {
        const { airport, fieldId } = event.detail;
        const waypointIndex = parseInt(fieldId.replace('waypoint', '')) - 1;
    
        if (waypointIndex >= 0 && waypointIndex < appState.waypoints.length) {
            updateState('updateWaypoint', { index: waypointIndex, data: airport });
        } else {
            updateState('addWaypoint', airport);
        }

        // Move map view to include the selected airport marker
        if (airport && airport.latitude && airport.longitude) {
            const latLng = L.latLng(airport.latitude, airport.longitude);
            map.flyTo(latLng, 4); // Adjust zoom level as needed
        }
    });
         
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
    const iataCodeMatch = fieldValue.match(/\(([^)]+)\)/);
    return iataCodeMatch ? iataCodeMatch[1] : null;
}

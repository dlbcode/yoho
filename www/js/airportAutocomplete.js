import { updateState, appState } from './stateManager.js';

document.addEventListener('DOMContentLoaded', (event) => {
    // Function to fetch airports from your endpoint
    async function fetchAirports(query) {
        try {
            const response = await fetch(`http://yonderhop.com:3000/airports?query=${query}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const airports = await response.json();
            return airports;
        } catch (error) {
            console.error('Fetch error:', error);
            return [];
        }
    }

    // Listen for new waypoint field creation
    document.addEventListener('newWaypointField', (event) => {
        const { fieldId } = event.detail;
        setupAutocompleteForField(fieldId);
    });

    function setupAutocompleteForField(fieldId) {
        const inputField = document.getElementById(fieldId);
        const suggestionBox = document.getElementById(fieldId + 'Suggestions');

        inputField.addEventListener('input', async (e) => {
            const airports = await fetchAirports(e.target.value);
            updateSuggestions(fieldId, airports);
        });

        // Close suggestions and blur input when clicking outside
        document.addEventListener('click', (e) => {
            if (!inputField.contains(e.target) && !suggestionBox.contains(e.target)) {
                suggestionBox.style.display = 'none'; // Hide the suggestion box
                inputField.blur();
            }
        });

        // Show suggestions when the input field is focused
        inputField.addEventListener('focus', () => {
            suggestionBox.style.display = 'block';
        });

        // Close suggestions and blur input on escape key
        inputField.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                suggestionBox.style.display = 'none'; // Hide the suggestion box
                inputField.blur();
            }
        });
    }

    setupAutocompleteForField('waypoint1');

    function updateSuggestions(inputId, airports) {
        const suggestionBox = document.getElementById(inputId + 'Suggestions');
        suggestionBox.innerHTML = '';
        suggestionBox.style.display = 'block'; // Show the suggestion box
        airports.forEach(airport => {
            const div = document.createElement('div');
            div.textContent = `${airport.name} (${airport.iata_code}) - ${airport.city}, ${airport.country}`;
            div.addEventListener('click', () => {
                const inputField = document.getElementById(inputId);
                inputField.value = `${airport.city} (${airport.iata_code})`;
                suggestionBox.style.display = 'none'; // Hide the suggestion box

                // Dispatch custom event to add the selected airport to waypoints
                const selectedAirportEvent = new CustomEvent('airportSelected', { detail: { airport } });
                document.dispatchEvent(selectedAirportEvent);

                updateState(inputId, airport.iata_code);
            });
            suggestionBox.appendChild(div);
        });
    }
    
    document.addEventListener('airportSelected', (event) => {
        const { airport } = event.detail;
        if (airport) {
            updateState('addWaypoint', airport);
        }
    });

    document.addEventListener('stateChange', (event) => {
        const { key, value } = event.detail;
        if (key === 'waypoints') {
            value.forEach((_, index) => {
                setupAutocompleteForField(`waypoint${index + 1}`);
            });
        }
    });
});

function getIataFromField(inputId) {
    const fieldValue = document.getElementById(inputId).value;
    const iataCodeMatch = fieldValue.match(/\(([^)]+)\)/);
    const iataCode = iataCodeMatch ? iataCodeMatch[1] : null;
    return iataCode;
}

export { getIataFromField };

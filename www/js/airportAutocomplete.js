import { appState, updateState } from './stateManager.js';
import { map } from './map.js';
import { uiHandling } from './uiHandling.js';

let currentPositionMode = null;
let resizeObserver = null;

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

function handleSelection(e, inputId, airport) {
    const inputField = document.getElementById(inputId);
    const suggestionBox = document.getElementById(inputId + 'Suggestions');
    e.preventDefault();
    e.stopPropagation();

    inputField.value = `${airport.city}, (${airport.iata_code})`;
    suggestionBox.style.display = 'none';
    document.dispatchEvent(new CustomEvent('airportSelected', {
        detail: { airport, fieldId: inputId }
    }));
    inputField.setAttribute('data-selected-iata', airport.iata_code);
    inputField.blur();
}

function setupAutocompleteForField(fieldId) {
    const inputField = document.getElementById(fieldId);
    const suggestionBox = document.getElementById(fieldId + 'Suggestions');
    let selectionMade = false;
    let initialInputValue = "";
    let currentFocus = -1;

    inputField.setAttribute('autocomplete', 'new-password');
    inputField.setAttribute('name', 'waypoint-input-' + Date.now());
    inputField.setAttribute('readonly', true);

    inputField.addEventListener('focus', async () => {
        inputField.removeAttribute('readonly');
        initialInputValue = inputField.value;
        setSuggestionBoxPosition();

        const iataCode = inputField.getAttribute('data-selected-iata') || getIataFromField(fieldId);
        if (iataCode) {
            const airport = await fetchAirportByIata(iataCode);
            if (airport?.latitude && airport?.longitude) {
                map.flyTo([airport.latitude, airport.longitude], 6, {
                    animate: true,
                    duration: 0.5
                });
            }
        }
    });

    const setSuggestionBoxPosition = () => {
        const isMobile = window.innerWidth <= 600;
        const inputRect = inputField.getBoundingClientRect();
        const waypointContainer = inputField.closest('.waypoint-inputs-container');
        const containerRect = waypointContainer.getBoundingClientRect();
        
        if (isMobile) {
            Object.assign(suggestionBox.style, {
                position: 'fixed',
                top: '50px',
                left: '0',
                width: '100%',
                height: 'calc(100vh - 50px)',
                maxHeight: 'none',
                zIndex: '10000'
            });
        } else {
            const viewportHeight = window.innerHeight;
            const spaceBelow = viewportHeight - containerRect.bottom;
            const spaceAbove = containerRect.top;
            
            Object.assign(suggestionBox.style, {
                position: 'fixed',
                width: `${containerRect.width}px`,
                left: `${containerRect.left}px`,
                maxHeight: '200px',
                zIndex: '1000',
                top: spaceBelow >= 200 || spaceBelow > spaceAbove ? 
                    `${containerRect.bottom}px` : 
                    `${containerRect.top - 200}px`
            });
        }

        // Maintain visibility if suggestions exist
        if (suggestionBox.children.length > 0) {
            suggestionBox.style.display = 'block';
        }
    };

    // Handle resize events
    const handleResize = () => {
        if (suggestionBox.style.display === 'block') {
            setSuggestionBoxPosition();
        }
    };

    // Set up resize observer
    if (resizeObserver) resizeObserver.disconnect();
    resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(document.documentElement);

    window.visualViewport?.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    // Remove position mode tracking
    currentPositionMode = null;

    // Show suggestions only when there are results
    inputField.addEventListener('input', async () => {
        const query = inputField.value;
        if (query.length >= 2) {
            const airports = await fetchAirports(query);
            if (airports.length > 0) {
                updateSuggestions(fieldId, airports);
                suggestionBox.style.display = 'block';
                setSuggestionBoxPosition();
            } else {
                suggestionBox.style.display = 'none';
            }
        } else {
            suggestionBox.style.display = 'none';
        }
    });

    const toggleSuggestionBox = (display) => {
        suggestionBox.style.display = display ? 'block' : 'none';
        if (display) {
            setSuggestionBoxPosition();
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
        }
    };

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
            if (inputField.value === '' && appState.waypoints.length > 0) {
                const waypointIndex = parseInt(inputField.id.replace('waypoint-input-', '')) - 1;
                updateState('removeWaypoint', waypointIndex, 'airportAutocomplete.addEventListener3');
            }
        }, 300);
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

function updateSuggestions(inputId, airports) {
    const suggestionBox = document.getElementById(inputId + 'Suggestions');
    suggestionBox.innerHTML = '';
    let selectionHandledByTouch = false;

    airports.forEach(airport => {
        const div = document.createElement('div');
        div.textContent = `${airport.name} (${airport.iata_code}) - ${airport.city}, ${airport.country}`;

        const selectionHandler = (e) => {
            setTimeout(() => {
                handleSelection(e, inputId, airport);
            }, 100);
        };

        div.addEventListener('touchstart', (e) => {
            selectionHandledByTouch = false;
            div.style.pointerEvents = 'none';
        }, { passive: true });

        div.addEventListener('touchmove', (e) => {
            selectionHandledByTouch = true;
        }, { passive: true });

        div.addEventListener('touchend', (e) => {
            div.style.pointerEvents = 'auto';
            if (!selectionHandledByTouch) {
                selectionHandler(e);
            }
            selectionHandledByTouch = false;
        });

        div.addEventListener('click', (e) => {
            selectionHandler(e);
        });

        suggestionBox.appendChild(div);
    });

    if (airports.length > 0) suggestionBox.style.display = 'block';
}

document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('airportSelected', (event) => {
        const { airport, fieldId } = event.detail;
        const waypointIndex = parseInt(fieldId.replace('waypoint-input-', '')) - 1;

        if (waypointIndex >= 0 && waypointIndex < appState.waypoints.length) {
            updateState('updateWaypoint', { index: waypointIndex, data: airport }, 'airportAutocomplete.addEventListener1');
        } else {
            updateState('addWaypoint', airport, 'airportAutocomplete.addEventListener2');
        }

        if (airport && airport.latitude && airport.longitude) {
            const latLng = L.latLng(airport.latitude, airport.longitude);
            const currentLatLng = map.getCenter();
            const adjustedLatLng = adjustLatLngForShortestPath(currentLatLng, latLng);
            map.flyTo(adjustedLatLng, 4, {
                animate: true,
                duration: 0.5
            });
        }
        uiHandling.setFocusToNextUnsetInput();
    });

    function adjustLatLngForShortestPath(currentLatLng, targetLatLng) {
        let currentLng = currentLatLng.lng;
        let targetLng = targetLatLng.lng;
        let lngDifference = targetLng - currentLng;

        if (lngDifference > 180) {
            targetLng -= 360;
        } else if (lngDifference < -180) {
            targetLng += 360;
        }

        return L.latLng(targetLatLng.lat, targetLng);
    }

    // Update the stateChange event listener to use correct IDs
    document.addEventListener('stateChange', (event) => {
        if (event.detail.key === 'waypoints') {
            event.detail.value.forEach((_, index) => {
                setupAutocompleteForField(`waypoint-input-${index + 1}`);
            });
        }
    });
});

export function getIataFromField(inputId) {
    const fieldValue = document.getElementById(inputId).value;
    const iataCodeMatch = fieldValue.match(/\b([A-Z]{3})\b/);
    return iataCodeMatch ? iataCodeMatch[1] : null;
}

export { setupAutocompleteForField, fetchAirportByIata };
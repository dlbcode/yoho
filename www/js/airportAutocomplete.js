import { appState, updateState } from './stateManager.js';
import { map } from './map.js';
import { uiHandling } from './uiHandling.js';

let currentPositionMode = null;
let resizeObserver = null;

// Add this debounce function at the top of the file
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

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

    // Create a listener registry for cleanup
    const listeners = new Map();
    
    // Function to add event listeners with automatic tracking
    const addTrackedListener = (element, event, handler, options) => {
        element.addEventListener(event, handler, options);
        if (!listeners.has(element)) listeners.set(element, []);
        listeners.get(element).push({ event, handler });
    };
    
    // Function to remove all tracked listeners
    const cleanup = () => {
        listeners.forEach((eventList, element) => {
            if (element) {
                eventList.forEach(({ event, handler }) => {
                    element.removeEventListener(event, handler);
                });
            }
        });
        listeners.clear();
        
        // Clean up observer
        if (resizeObserver) {
            resizeObserver.disconnect();
            resizeObserver = null;
        }
        
        window.visualViewport?.removeEventListener('resize', handleResize);
        window.removeEventListener('orientationchange', handleResize);
    };
    
    // Store cleanup function on the input element
    inputField.airportAutocompleteCleanup = cleanup;

    addTrackedListener(inputField, 'focus', async () => {
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
        if (!suggestionBox) return;
        
        const isMobile = window.innerWidth <= 600;
        const inputRect = inputField.getBoundingClientRect();
        const maxMenuHeight = 200;
        
        // Base styles for all cases
        const baseStyles = {
            position: 'fixed',
            zIndex: '10000',
            display: suggestionBox.children.length > 0 ? 'block' : 'none'
        };
        
        if (isMobile) {
            // Mobile styles
            Object.assign(suggestionBox.style, baseStyles, {
                top: '50px',
                left: '0',
                width: '100%',
                maxHeight: 'calc(100vh - 50px)',
                minHeight: 'none'
            });
        } else {
            // Desktop positioning logic
            const viewportHeight = window.innerHeight;
            const spaceBelow = viewportHeight - inputRect.bottom;
            const spaceAbove = inputRect.top;
            const showAbove = spaceBelow < maxMenuHeight && spaceAbove >= maxMenuHeight;
            
            Object.assign(suggestionBox.style, baseStyles, {
                width: `${inputRect.width}px`,
                left: `${inputRect.left}px`,
                maxHeight: `${Math.min(maxMenuHeight, showAbove ? spaceAbove : spaceBelow)}px`,
                [showAbove ? 'bottom' : 'top']: `${showAbove ? viewportHeight - inputRect.top : inputRect.bottom}px`,
                [showAbove ? 'top' : 'bottom']: 'auto'
            });
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
    const debouncedInputHandler = debounce(async () => {
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
    }, 200); // 200ms delay

    addTrackedListener(inputField, 'input', debouncedInputHandler);

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

    addTrackedListener(inputField, 'keydown', (e) => {
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

    addTrackedListener(inputField, 'blur', () => {
        setTimeout(() => {
            const waypointIndex = parseInt(inputField.id.replace('waypoint-input-', '')) - 1;
            const waypoint = appState.waypoints[waypointIndex];
            const currentValue = inputField.value;
            
            // Check if this is an "Any" destination that we should preserve
            const isAnyDestination = 
                currentValue === 'Any' || 
                inputField.getAttribute('data-is-any-destination') === 'true' ||
                (waypoint && (waypoint.iata_code === 'Any' || waypoint.isAnyDestination === true));
            
            // Don't clear "Any" destination fields
            if (!isAnyDestination) {
                clearInputField(inputField);
                toggleSuggestionBox(false);
                
                // Only remove empty waypoints that aren't "Any" destinations
                if (currentValue === '' && appState.waypoints.length > 0 && !window.preserveAnyDestination) {
                    updateState('removeWaypoint', waypointIndex, 'airportAutocomplete.addEventListener3');
                }
            } else {
                toggleSuggestionBox(false);
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
    if (!suggestionBox) return;
    
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

    if (airports.length > 0) {
        // Force higher z-index and display
        suggestionBox.style.display = 'block';
        suggestionBox.style.zIndex = '10000'; 
        
        // If input is expanded, ensure suggestions are positioned correctly
        const inputField = document.getElementById(inputId);
        if (inputField?.classList.contains('expanded-input')) {
            Object.assign(suggestionBox.style, {
                position: 'fixed',
                top: '50px',
                left: '0',
                width: '100%',
                maxHeight: 'calc(100vh - 50px)'
            });
        } else if (inputField) {
            // Get positioning from the input
            const rect = inputField.getBoundingClientRect();
            if (window.innerWidth > 600) {
                Object.assign(suggestionBox.style, {
                    position: 'fixed',
                    top: `${rect.bottom}px`,
                    left: `${rect.left}px`,
                    width: `${rect.width}px`
                });
            }
        }
    }
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
        if (window.innerWidth > 600) {
            uiHandling.setFocusToNextUnsetInput();
        }
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
            event.detail.value.forEach((waypoint, index) => {
                // Only set up autocomplete for fields that aren't intentionally set to "Any"
                const fieldId = `waypoint-input-${index + 1}`;
                const field = document.getElementById(fieldId);
                
                // Don't clear a field intentionally set to "Any"
                if (!(field && field.value === "Any")) {
                    setupAutocompleteForField(fieldId);
                }
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
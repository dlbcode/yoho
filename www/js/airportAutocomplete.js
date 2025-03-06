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

// At the top of your file, add these utility functions

function createEventHandler(handlerFn) {
    return function(e) {
        e.preventDefault();
        e.stopPropagation();
        handlerFn.apply(this, arguments);
    };
}

function addMultiEventListener(element, events, handler, options = {}) {
    events.forEach(event => element.addEventListener(event, handler, options));
    return () => events.forEach(event => element.removeEventListener(event, handler));
}

// Replace the fetch functions with more robust versions

async function fetchAirports(query) {
    if (!query || query.length < 2) return [];
    
    try {
        const encodedQuery = encodeURIComponent(query.trim());
        const response = await fetch(`https://yonderhop.com/api/airports?query=${encodedQuery}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.warn('Error fetching airports:', error);
        return [];
    }
}

async function fetchAirportByIata(iata) {
    if (!iata) return null;
    
    try {
        const encodedIata = encodeURIComponent(iata.trim());
        const response = await fetch(`https://yonderhop.com/api/airports?iata=${encodedIata}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
        }
        
        const airports = await response.json();
        return airports.length > 0 ? airports[0] : null;
    } catch (error) {
        console.error('Failed to fetch airport data:', error);
        return null;
    }
}

// Add this class to manage event listeners more efficiently

class ListenerManager {
    constructor() {
        this.listeners = new Map();
    }
    
    add(element, event, handler, options) {
        element.addEventListener(event, handler, options);
        if (!this.listeners.has(element)) {
            this.listeners.set(element, []);
        }
        this.listeners.get(element).push({ event, handler });
        return this;
    }
    
    addMultiple(element, events, handler, options) {
        events.forEach(event => this.add(element, event, handler, options));
        return this;
    }
    
    cleanup() {
        this.listeners.forEach((eventList, element) => {
            if (element) {
                eventList.forEach(({ event, handler }) => {
                    element.removeEventListener(event, handler);
                });
            }
        });
        this.listeners.clear();
    }
}

// Added selecting flag to track if selection is in progress
let isSelectingItem = false;

function handleSelection(e, inputId, airport) {
    const inputField = document.getElementById(inputId);
    const suggestionBox = document.getElementById(inputId + 'Suggestions');
    e.preventDefault();
    e.stopPropagation();
    
    // Set the flag to prevent blur from clearing
    isSelectingItem = true;
    
    // IMPORTANT: Clear any "Anywhere" related attributes when selecting a specific airport
    inputField.removeAttribute('data-is-any-destination');
    inputField.removeAttribute('data-paired-with-anywhere');
    
    inputField.value = `${airport.city}, (${airport.iata_code})`;
    inputField.setAttribute('data-selected-iata', airport.iata_code);
    
    // Hide suggestions
    suggestionBox.style.display = 'none';
    
    // Dispatch custom event for airport selection
    document.dispatchEvent(new CustomEvent('airportSelected', {
        detail: { airport, fieldId: inputId }
    }));
    
    // Use setTimeout to allow event to complete before blur
    setTimeout(() => {
        inputField.blur();
        // Reset flag after a short delay
        setTimeout(() => {
            isSelectingItem = false;
        }, 100);
    }, 50);
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
    const listenerManager = new ListenerManager();
    
    // Function to add event listeners with automatic tracking
    const addTrackedListener = (element, event, handler, options) => {
        listenerManager.add(element, event, handler, options);
    };
    
    // Function to remove all tracked listeners
    const cleanup = () => {
        listenerManager.cleanup();
        
        // Clean up observer
        if (resizeObserver) {
            resizeObserver.disconnect();
            resizeObserver = null;
        }
        
        window.visualViewport?.removeEventListener('resize', handleResize);
        window.removeEventListener('orientationchange', handleResize);

        // Disconnect observer
        suggestionObserver && suggestionObserver.disconnect();
    };
    
    // Store cleanup function on the input element
    inputField.airportAutocompleteCleanup = cleanup;

    addTrackedListener(inputField, 'focus', async () => {
        inputField.removeAttribute('readonly');
        initialInputValue = inputField.value;
        
        // Get waypoint index and check if this is an origin field
        const waypointIndex = parseInt(fieldId.replace('waypoint-input-', '')) - 1;
        const isOriginField = waypointIndex % 2 === 0;
        
        // If this is an origin field and we just set destination to "Anywhere", handle specially
        if (isOriginField && window.justSelectedAnywhereDestination) {
            // Reset the flag
            window.justSelectedAnywhereDestination = false;
            
            // Force a check of the destination field
            const pairIndex = waypointIndex + 1;
            const pairField = document.getElementById(`waypoint-input-${pairIndex + 1}`);
            
            if (pairField && pairField.value === 'Anywhere') {
                // Only show airport suggestions, not "Anywhere" option
                inputField.setAttribute('data-paired-with-anywhere', 'true');
            }
        }
        
        // Show the "Anywhere" option when any field is focused and empty
        if (!inputField.value) {
            // Create and show the suggestion box with just the "Anywhere" option
            updateSuggestions(fieldId, []);
            setSuggestionBoxPosition(inputField, suggestionBox);
        }
        
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

    // Handle resize events
    const handleResize = () => {
        if (suggestionBox.style.display === 'block') {
            setSuggestionBoxPosition(inputField, suggestionBox);
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
                setSuggestionBoxPosition(inputField, suggestionBox);
                
                // Automatically highlight the first suggestion
                currentFocus = 0;
                const items = suggestionBox.getElementsByTagName('div');
                if (items.length > 0) {
                    updateActiveItem(items);
                }
            } else {
                // Show just the "Anywhere" option when no results found
                updateSuggestions(fieldId, []);
                setSuggestionBoxPosition(inputField, suggestionBox);
            }
        } else if (query.length < 2) {
            // Show just the "Anywhere" option when field is empty or has 1 character
            // This covers both empty field and 1-character cases
            updateSuggestions(fieldId, []);
            setSuggestionBoxPosition(inputField, suggestionBox);
        }
    }, 200); // 200ms delay

    addTrackedListener(inputField, 'input', debouncedInputHandler);

    const toggleSuggestionBox = (display) => {
        suggestionBox.style.display = display ? 'block' : 'none';
        if (display) {
            setSuggestionBoxPosition(inputField, suggestionBox);
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
            currentFocus = -1;
        } else if (e.key === 'ArrowDown') {
            if (suggestionBox.style.display === 'block') {
                currentFocus++;
                updateActiveItem(suggestionBox.getElementsByTagName('div'));
            }
        } else if (e.key === 'ArrowUp') {
            if (suggestionBox.style.display === 'block') {
                currentFocus--;
                updateActiveItem(suggestionBox.getElementsByTagName('div'));
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (suggestionBox.style.display === 'block') {
                const items = suggestionBox.getElementsByTagName('div');
                if (items && items.length > 0) {
                    // If we have a focused item, click it
                    if (currentFocus >= 0 && currentFocus < items.length) {
                        items[currentFocus].click();
                    } 
                    // If no item is focused but suggestions exist, click the first one
                    else if (items.length > 0) {
                        currentFocus = 0;
                        updateActiveItem(items);
                        items[0].click();
                    }
                }
            }
        }
    });

    inputField.addEventListener('blur', (e) => {
        // Don't process blur immediately if we're selecting an item
        if (isSelectingItem) {
            return;
        }
        
        // Use requestIdleCallback for non-critical operations if supported
        const delayedTask = () => {
            // If a selection is in progress, don't process blur
            if (isSelectingItem) {
                return;
            }
            
            const waypointIndex = parseInt(inputField.id.replace('waypoint-input-', '')) - 1;
            
            // Check conditions once and store in variables
            const currentValue = inputField.value;
            const isAnyDestination = currentValue === 'Any' || 
                inputField.getAttribute('data-is-any-destination') === 'true' ||
                (appState.waypoints[waypointIndex] && 
                 (appState.waypoints[waypointIndex].iata_code === 'Any' || 
                  appState.waypoints[waypointIndex].isAnyDestination === true));
            
            const isEmpty = currentValue === '';
            const shouldRemoveWaypoint = !isAnyDestination && isEmpty && 
                appState.waypoints.length > 0 && !window.preserveAnyDestination;
            
            if (!isAnyDestination) {
                clearInputField(inputField);
                toggleSuggestionBox(false);
                
                // Only attempt to remove waypoint if conditions are met
                if (shouldRemoveWaypoint) {
                    updateState('removeWaypoint', waypointIndex, 'airportAutocomplete.addEventListener3');
                }
            } else {
                toggleSuggestionBox(false);
            }
        };
        
        // Use requestIdleCallback if available, otherwise setTimeout
        // Increase delay to 200ms to give click events more time to process
        if ('requestIdleCallback' in window) {
            window.requestIdleCallback(delayedTask, { timeout: 300 });
        } else {
            setTimeout(delayedTask, 300);
        }
    });

    if (!window.outsideClickListenerAdded) {
        document.addEventListener('click', outsideClickListener);
        window.outsideClickListenerAdded = true;
    }

    function updateActiveItem(items) {
        if (!items || items.length === 0) return false;
        const itemsArray = Array.from(items);
        
        // Clear any existing active item
        itemsArray.forEach(item => item.classList.remove('autocomplete-active'));
        
        // Ensure currentFocus wraps around properly
        currentFocus = ((currentFocus % itemsArray.length) + itemsArray.length) % itemsArray.length;
        
        // Set new active item
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

    // Add at the beginning of setupAutocompleteForField
    const suggestionObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Suggestion box is visible, update position
                setSuggestionBoxPosition(inputField, suggestionBox);
            }
        });
    }, { threshold: 0.1 });

    // Observe the suggestion box
    suggestionBox && suggestionObserver.observe(suggestionBox);
}

// Replace the updateSuggestions function with this cleaner version

function updateSuggestions(inputId, airports) {
    const suggestionBox = document.getElementById(inputId + 'Suggestions');
    if (!suggestionBox) return;
    
    // Clear existing suggestions
    suggestionBox.innerHTML = '';
    
    // Move to body if needed
    if (suggestionBox.parentElement !== document.body) {
        document.body.appendChild(suggestionBox);
    }
    
    // Get UI state information
    const waypointIndex = parseInt(inputId.replace('waypoint-input-', '')) - 1;
    const isOriginField = waypointIndex % 2 === 0;
    
    // Determine paired waypoint
    const pairIndex = isOriginField ? waypointIndex + 1 : waypointIndex - 1;
    const pairInputId = `waypoint-input-${pairIndex + 1}`;
    
    // Get the pair field
    const pairField = document.getElementById(pairInputId);
    
    // More strict check for "Anywhere" in paired field - check it's EXACTLY "Anywhere"
    const pairFieldHasAnywhere = pairField && (
        pairField.value === 'Anywhere' || 
        pairField.getAttribute('data-is-any-destination') === 'true' ||
        pairField.getAttribute('data-selected-iata') === 'Any'
    );
    
    // Check if pair exists in state
    const pairWaypoint = (pairIndex >= 0 && pairIndex < appState.waypoints.length) ? 
        appState.waypoints[pairIndex] : null;
    
    // Check if pair has "Anywhere" selected - include DOM check
    const isPairAny = pairFieldHasAnywhere || (pairWaypoint && 
        (pairWaypoint.iata_code === 'Any' || 
         pairWaypoint.isAnyDestination === true ||
         pairWaypoint.isAnyOrigin === true));
         
    const inputField = document.getElementById(inputId);
    const isEmptySearch = airports.length === 0;
    
    // Enhanced debugging to identify the issue
    console.log(`Field: ${inputId}, isOrigin: ${isOriginField}, pairIndex: ${pairIndex}, isPairAny: ${isPairAny}`, 
                `pairFieldHasAnywhere: ${pairFieldHasAnywhere}`,
                pairWaypoint ? `Pair: ${pairWaypoint.iata_code}` : 'No pair');
    
    // Add "Anywhere" option if needed, with additional check for the special attribute
    const isPairedWithAnywhere = inputField.getAttribute('data-paired-with-anywhere') === 'true';
    
    if ((isEmptySearch || inputField.hasAttribute('data-show-anywhere-option')) && 
        !isPairAny && !isPairedWithAnywhere) {
        const anywhereDiv = document.createElement('div');
        anywhereDiv.className = 'anywhere-suggestion';
        anywhereDiv.textContent = 'Anywhere';
        anywhereDiv.setAttribute('data-is-anywhere', 'true');
        
        const anywhereHandler = createAnywhereHandler(inputId, inputField, suggestionBox, isOriginField, pairIndex, isPairAny);
        
        if ('ontouchstart' in window) {
            anywhereDiv.addEventListener('touchend', anywhereHandler);
        }
        anywhereDiv.addEventListener('mousedown', anywhereHandler);
        anywhereDiv.addEventListener('click', anywhereHandler);
        
        suggestionBox.appendChild(anywhereDiv);
    }
    
    // Add airport suggestions
    airports.forEach((airport, index) => {
        const div = document.createElement('div');
        div.textContent = `${airport.name} (${airport.iata_code}) - ${airport.city}, ${airport.country}`;
        
        if (index === 0) {
            div.classList.add('autocomplete-active');
        }

        const selectionHandler = createSelectionHandler(inputId, airport);
        
        // Touch event handling
        if ('ontouchstart' in window) {
            let selectionHandledByTouch = false;
            div.addEventListener('touchstart', () => { selectionHandledByTouch = false; }, { passive: true });
            div.addEventListener('touchmove', () => { selectionHandledByTouch = true; }, { passive: true });
            div.addEventListener('touchend', (e) => {
                if (!selectionHandledByTouch) selectionHandler(e);
            });
        }
        
        div.addEventListener('mousedown', selectionHandler);
        div.addEventListener('click', (e) => {
            if (!isSelectingItem) selectionHandler(e);
        });
        
        suggestionBox.appendChild(div);
    });
    
    // Show suggestion box and position it correctly
    if (suggestionBox.children.length > 0) {
        suggestionBox.style.display = 'block';
        suggestionBox.style.zIndex = '90';
        
        const inputField = document.getElementById(inputId);
        if (inputField) {
            setSuggestionBoxPosition(inputField, suggestionBox);
        }
    }
}

// Helper functions for updateSuggestions
function createAnywhereHandler(inputId, inputField, suggestionBox, isOriginField, pairIndex, isPairAny) {
    return function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        isSelectingItem = true;
        
        const waypointIndex = parseInt(inputId.replace('waypoint-input-', '')) - 1;
        
        // Additional check for the paired field's value
        const pairInputId = `waypoint-input-${pairIndex + 1}`;
        const pairField = document.getElementById(pairInputId);
        const pairFieldHasAnywhere = pairField && 
            (pairField.value === 'Anywhere' || 
             pairField.getAttribute('data-is-any-destination') === 'true' ||
             pairField.getAttribute('data-selected-iata') === 'Any');
        
        // Use both state and DOM info to determine if pair has "Anywhere"
        const effectiveIsPairAny = isPairAny || pairFieldHasAnywhere;
        
        if (isOriginField && effectiveIsPairAny && !window.isLoadingFromUrl) {
            alert("Both origin and destination cannot be set to 'Anywhere'");
            suggestionBox.style.display = 'none';
            isSelectingItem = false;
            return;
        }
        
        const anyDestination = {
            iata_code: 'Any',
            city: 'Anywhere',
            country: '',
            name: isOriginField ? 'Any Origin' : 'Any Destination',
            isAnyDestination: !isOriginField,
            isAnyOrigin: isOriginField
        };
        
        // Immediately update the DOM with the "Anywhere" attributes
        inputField.value = 'Anywhere';
        inputField.setAttribute('data-selected-iata', 'Any');
        inputField.setAttribute('data-is-any-destination', 'true');
        
        // Hide suggestions right away
        suggestionBox.style.display = 'none';
        
        // Update state
        if (waypointIndex >= 0 && waypointIndex < appState.waypoints.length) {
            updateState('updateWaypoint', { index: waypointIndex, data: anyDestination }, 'airportAutocomplete.anywhereSelection');
        } else {
            updateState('addWaypoint', anyDestination, 'airportAutocomplete.anywhereSelection');
        }
        
        // Use a longer delay to ensure state is properly updated before focusing other field
        setTimeout(() => {
            inputField.blur();
            
            // Increase delay to ensure DOM updates are complete
            setTimeout(() => {
                isSelectingItem = false;
                
                // If not mobile and the other waypoint input is empty, focus it
                if (window.innerWidth > 600) {
                    const otherIndex = isOriginField ? waypointIndex + 1 : waypointIndex - 1;
                    const otherField = document.getElementById(`waypoint-input-${otherIndex + 1}`);
                    
                    if (otherField && !otherField.value.trim()) {
                        // This is the key fix - force an update of the suggestions before focusing
                        // This ensures the "Anywhere" status of the current field is recognized
                        if (!isOriginField) {  // If this is destination with "Anywhere"
                            // Update global flag to track this special case
                            window.justSelectedAnywhereDestination = true;
                            
                            // Modify focus behavior to update suggestions properly
                            otherField.focus();
                            
                            // Update suggestions manually with empty list to force proper pair checking
                            updateSuggestions(`waypoint-input-${otherIndex + 1}`, []);
                        } else {
                            otherField.focus();
                        }
                    }
                }
            }, 200); // Increased from 100ms to 200ms
        }, 100); // Increased from 50ms to 100ms
    };
}

function createSelectionHandler(inputId, airport) {
    return function(e) {
        e.preventDefault();
        e.stopPropagation();
        isSelectingItem = true;
        
        // Get the input field 
        const inputField = document.getElementById(inputId);
        
        // IMPORTANT: Clear any "Anywhere" related attributes when selecting a specific airport
        inputField.removeAttribute('data-is-any-destination');
        inputField.removeAttribute('data-paired-with-anywhere');
        
        // Handle the selection
        handleSelection(e, inputId, airport);

        // If not mobile and the other waypoint input is empty, focus it
        if (window.innerWidth > 600) {
            const waypointIndex = parseInt(inputId.replace('waypoint-input-', '')) - 1;
            const isOriginField = (waypointIndex % 2 === 0);
            const pairIndex = isOriginField ? waypointIndex + 1 : waypointIndex - 1;
            const otherField = document.getElementById(`waypoint-input-${pairIndex + 1}`);
            if (otherField && !otherField.value.trim()) {
                otherField.focus();
            }
        }
    };
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

// Move this function outside of setupAutocompleteForField
function setSuggestionBoxPosition(inputField, suggestionBox) {
    if (!suggestionBox || !inputField) return;
    
    const isMobile = window.innerWidth <= 600;
    const inputRect = inputField.getBoundingClientRect();
    const waypointContainer = document.querySelector('.waypoint-inputs-container');
    const containerRect = waypointContainer ? waypointContainer.getBoundingClientRect() : null;
    const maxMenuHeight = 200;
    
    // Use the SAME logic as in updateSuggestions to determine if origin field
    const waypointIndex = parseInt(inputField.id.replace(/\D/g, ''), 10) - 1;
    const isOriginField = waypointIndex % 2 === 0;
    
    // Build style object based on conditions
    const styles = {
        position: 'fixed',
        zIndex: '10000',
        display: suggestionBox.children.length > 0 ? 'block' : 'none'
    };
    
    if (isMobile) {
        Object.assign(styles, {
            top: '50px',
            left: '0',
            width: '100%',
            maxHeight: 'calc(100vh - 50px)',
            minHeight: 'none'
        });
    } else if (containerRect) {
        const viewportHeight = window.innerHeight;
        const spaceBelow = viewportHeight - inputRect.bottom;
        const spaceAbove = inputRect.top;
        const showAbove = spaceBelow < maxMenuHeight && spaceAbove >= maxMenuHeight;
        
        const suggestionWidth = containerRect.width;
        
        // Calculate left position
        let left = isOriginField ? inputRect.left : (inputRect.right - suggestionWidth);
        
        // Keep within viewport bounds
        left = Math.max(0, Math.min(left, window.innerWidth - suggestionWidth));
        
        Object.assign(styles, {
            width: `${suggestionWidth}px`,
            left: `${left}px`,
            maxHeight: `${Math.min(maxMenuHeight, showAbove ? spaceAbove : spaceBelow)}px`,
            [showAbove ? 'bottom' : 'top']: `${showAbove ? viewportHeight - inputRect.top : inputRect.bottom}px`,
            [showAbove ? 'top' : 'bottom']: 'auto'
        });
    } else {
        Object.assign(styles, {
            width: `${inputRect.width}px`,
            left: `${inputRect.left}px`,
            maxHeight: `${maxMenuHeight}px`,
            top: `${inputRect.bottom}px`,
            bottom: 'auto'
        });
    }
    
    // Apply all styles at once
    Object.assign(suggestionBox.style, styles);
}
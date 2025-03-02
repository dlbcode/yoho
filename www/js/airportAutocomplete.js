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

// Added selecting flag to track if selection is in progress
let isSelectingItem = false;

function handleSelection(e, inputId, airport) {
    const inputField = document.getElementById(inputId);
    const suggestionBox = document.getElementById(inputId + 'Suggestions');
    e.preventDefault();
    e.stopPropagation();
    
    // Set the flag to prevent blur from clearing
    isSelectingItem = true;
    
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

        // Disconnect observer
        suggestionObserver && suggestionObserver.disconnect();
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
        const waypointContainer = document.querySelector('.waypoint-inputs-container');
        const containerRect = waypointContainer ? waypointContainer.getBoundingClientRect() : null;
        const maxMenuHeight = 200;
        
        // Get the index to determine if this is origin or destination
        const inputIndex = parseInt(fieldId.replace(/\D/g, ''), 10) % 2;
        const isOriginField = inputIndex === 1; // First field (odd number)
        
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
        } else if (containerRect) {
            // Desktop positioning with container reference
            const viewportHeight = window.innerHeight;
            const spaceBelow = viewportHeight - inputRect.bottom;
            const spaceAbove = inputRect.top;
            const showAbove = spaceBelow < maxMenuHeight && spaceAbove >= maxMenuHeight;
            
            // Container-wide dropdown that aligns with input field edges
            const suggestionWidth = containerRect.width;
            
            let left;
            if (isOriginField) {
                // For origin: align left edge with input left edge
                left = inputRect.left;
            } else {
                // For destination: align right edge with input right edge
                left = inputRect.right - suggestionWidth;
            }
            
            // Ensure dropdown stays within viewport
            if (left < 0) left = 0;
            if (left + suggestionWidth > window.innerWidth) {
                left = Math.max(0, window.innerWidth - suggestionWidth);
            }
            
            Object.assign(suggestionBox.style, baseStyles, {
                width: `${suggestionWidth}px`,
                left: `${left}px`,
                maxHeight: `${Math.min(maxMenuHeight, showAbove ? spaceAbove : spaceBelow)}px`,
                [showAbove ? 'bottom' : 'top']: `${showAbove ? viewportHeight - inputRect.top : inputRect.bottom}px`,
                [showAbove ? 'top' : 'bottom']: 'auto'
            });
        } else {
            // Fallback positioning if container isn't found
            Object.assign(suggestionBox.style, baseStyles, {
                width: `${inputRect.width}px`,
                left: `${inputRect.left}px`,
                maxHeight: `${maxMenuHeight}px`,
                top: `${inputRect.bottom}px`,
                bottom: 'auto'
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
                
                // Automatically highlight the first suggestion
                currentFocus = 0;
                const items = suggestionBox.getElementsByTagName('div');
                if (items.length > 0) {
                    updateActiveItem(items);
                }
            } else {
                suggestionBox.style.display = 'none';
                currentFocus = -1;
            }
        } else {
            suggestionBox.style.display = 'none';
            currentFocus = -1;
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
                setSuggestionBoxPosition();
            }
        });
    }, { threshold: 0.1 });

    // Observe the suggestion box
    suggestionBox && suggestionObserver.observe(suggestionBox);
}

function updateSuggestions(inputId, airports) {
    const suggestionBox = document.getElementById(inputId + 'Suggestions');
    if (!suggestionBox) return;
    
    suggestionBox.innerHTML = '';
    let selectionHandledByTouch = false;

    airports.forEach((airport, index) => {
        const div = document.createElement('div');
        div.textContent = `${airport.name} (${airport.iata_code}) - ${airport.city}, ${airport.country}`;
        
        // Highlight the first item by default
        if (index === 0) {
            div.classList.add('autocomplete-active');
        }

        // Create a single handler for all selection events with improved reliability
        const selectionHandler = (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Set flag to prevent blur handler from interfering
            isSelectingItem = true;
            
            // Call handleSelection with proper arguments
            handleSelection(e, inputId, airport);
        };

        // For touch devices, use more reliable touch event handling
        if ('ontouchstart' in window) {
            div.addEventListener('touchstart', (e) => {
                selectionHandledByTouch = false;
            }, { passive: true });

            div.addEventListener('touchmove', () => {
                selectionHandledByTouch = true;
            }, { passive: true });

            div.addEventListener('touchend', (e) => {
                if (!selectionHandledByTouch) {
                    selectionHandler(e);
                }
            });
        }

        // For mouse users, use mousedown instead of click for faster response
        div.addEventListener('mousedown', (e) => {
            selectionHandler(e);
            // Prevent the blur event that would be triggered
            e.preventDefault();
        });

        // Keep the click handler as backup
        div.addEventListener('click', (e) => {
            if (!isSelectingItem) {
                selectionHandler(e);
            }
        });

        suggestionBox.appendChild(div);
    });

    if (airports.length > 0) {
        // Force higher z-index and display
        suggestionBox.style.display = 'block';
        suggestionBox.style.zIndex = '90'; // Was 10000 - now matches our new scale
        
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
            // Get positioning from input field
            const inputRect = inputField.getBoundingClientRect();
            const waypointContainer = document.querySelector('.waypoint-inputs-container');
            const containerRect = waypointContainer ? waypointContainer.getBoundingClientRect() : null;
            
            // Determine if this is origin or destination based on the input ID
            const inputIndex = parseInt(inputId.replace(/\D/g, ''), 10) % 2;
            const isOriginField = inputIndex === 1; // First field (odd number)
            
            if (containerRect && window.innerWidth > 600) {
                // Container-wide dropdown that aligns with input field edges
                const suggestionWidth = containerRect.width;
                
                let left;
                if (isOriginField) {
                    // For origin: align left edge with input left edge
                    left = inputRect.left;
                } else {
                    // For destination: align right edge with input right edge
                    left = inputRect.right - suggestionWidth;
                }
                
                // Ensure dropdown stays within viewport
                if (left < 0) left = 0;
                if (left + suggestionWidth > window.innerWidth) {
                    left = Math.max(0, window.innerWidth - suggestionWidth);
                }
                
                Object.assign(suggestionBox.style, {
                    position: 'fixed',
                    top: `${inputRect.bottom}px`,
                    left: `${left}px`,
                    width: `${suggestionWidth}px`
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
import { appState, updateState } from './stateManager.js';
import { map } from './map.js';
import { applyFilters } from './routeDeck/deckFilter.js';
import { uiHandling } from './uiHandling.js';
import { routeBox } from './routeBox/routeBox.js';
import { lineManager } from './lineManager.js';
import { infoPaneHeight } from './utils/infoPaneHeightManager.js';
import { inputManager } from './inputManager.js'; // Add new import

const infoPane = {
    routeDecks: new Map(),

    init() {
        document.addEventListener('stateChange', this.handleStateChange.bind(this));
        document.getElementById('tripButton').addEventListener('click', this.handleTripButtonClick.bind(this));
        this.addPlusButton();
        
        // Modified logic: Use setTimeout to ensure DOM is fully ready
        setTimeout(() => {
            // Check if there are no routes
            const hasNoRoutes = (
                Array.isArray(appState.routeData) && appState.routeData.length === 0 ||
                !appState.routeData || 
                Object.keys(appState.routeData).length === 0
            );
            
            // Check URL for routes parameter
            const urlParams = new URLSearchParams(window.location.search);
            
            // Create initial routeBox if needed
            if (hasNoRoutes && !urlParams.has('routes')) {
                this.handlePlusButtonClick();
            } else if (urlParams.has('routes') && !document.querySelector('#routeBox')) {
                // If routes are in URL but no routeBox is displayed, show the first route
                const firstRouteIndex = Object.keys(appState.routeData)
                    .filter(key => appState.routeData[key] && !appState.routeData[key].isEmpty)
                    .sort((a, b) => parseInt(a) - parseInt(b))[0] || 0;
                    
                setupRouteContent(parseInt(firstRouteIndex));
            }
        }, 100); // Short delay to ensure state is initialized
    },

    handleTripButtonClick() {
        appState.currentView = 'trip';
        this.displayContent();

        // Update to use routeData for fitting map bounds
        const validRoutes = Object.values(appState.routeData).filter(r => r && !r.isEmpty);
        const waypoints = [];
        
        validRoutes.forEach(route => {
            if (route.origin && route.origin.latitude && route.origin.longitude) {
                waypoints.push([route.origin.latitude, route.origin.longitude]);
            }
            if (route.destination && route.destination.latitude && route.destination.longitude) {
                waypoints.push([route.destination.latitude, route.destination.longitude]);
            }
        });

        if (waypoints.length > 0) {
            map.fitBounds(L.latLngBounds(waypoints), { padding: [50, 50] });
        }
    },

    handleStateChange(event) {
        this.updateRouteButtons();
        if (['updateSelectedRoute', 'removeSelectedRoute', 'changeView', 'updateRoutes'].includes(event.detail.key)) {
            this.displayContent();
        }
    },

    displayContent() {
        // Remove commented-out lines and unused variables
    },

    // Add the missing handleRouteButtonClick method
    handleRouteButtonClick(routeIndex) {
        const selectedRoute = appState.routeData[routeIndex];

        if (selectedRoute && selectedRoute.selectedRoute) {
            // If the route is selected, display the selected route information page
            import('./routeDeck/selectedRoute.js').then(({ selectedRoute }) => {
                selectedRoute.displaySelectedRouteInfo(routeIndex);
            });
        } else {
            // For non-selected routes, just show the route content
            // No need to update styling for a non-selected route
            setupRouteContent(routeIndex);
        }
    },

    updateRouteButtons() {
        const menuBar = document.getElementById('menu-bar');
        menuBar.innerHTML = '';

        // Create buttons for all routes in routeData
        appState.routeData.forEach((route, index) => {
            if (!route || route.isEmpty) return;

            // Skip creating buttons for routes that don't have at least one valid waypoint
            const origin = route.origin?.iata_code || null;
            const destination = route.destination?.iata_code || null;
            
            // Check if we have at least one specific location (not "Any" and not null)
            const hasValidOrigin = origin && origin !== 'Any';
            const hasValidDestination = destination && destination !== 'Any';
            
            // Skip this route if neither origin nor destination is a specific location
            if (!hasValidOrigin && !hasValidDestination) return;

            const buttonId = `route-button-${index}`;
            let button = document.getElementById(buttonId) || document.createElement('button');

            if (!button.id) {
                button.id = buttonId;
                button.className = 'route-info-button';
                
                // Add even-button class to alternate gradient directions
                if (index % 2 === 1) {
                    button.classList.add('even-button');
                }
                
                menuBar.appendChild(button);
            }

            button.innerHTML = '';

            const originElement = document.createElement('span');
            originElement.className = 'origin-iata';
            originElement.textContent = origin || 'Any';

            if (origin === 'Any' || !origin) {
                originElement.classList.add('any-waypoint');
            }

            button.appendChild(originElement);

            const destElement = document.createElement('span');
            destElement.className = 'dest-iata';
            destElement.textContent = destination || 'Any';

            if (destination === 'Any' || !destination) {
                destElement.classList.add('any-waypoint');
            }

            button.appendChild(destElement);

            button.onclick = () => this.handleRouteButtonClick(index);

            if (!appState.preventMapViewChange) {
                this.fitMapToRoute(index);
            }

            if (route.selectedRoute) {
                button.classList.add('selected-route-button');
            } else {
                button.classList.remove('selected-route-button');
            }

            const dateRange = {
                depart: route.departDate,
                return: route.returnDate
            };

            if (dateRange) {
                uiHandling.attachDateTooltip(button, index, dateRange);
            }

            button.addEventListener('mouseover', () => {
                if (origin && origin !== 'Any' && destination && destination !== 'Any') {
                    this.applyToLines([`route:${origin}-${destination}`], 'highlight');
                }
            });
            button.addEventListener('mouseout', () => {
                if (origin && origin !== 'Any' && destination && destination !== 'Any') {
                    this.applyToLines([`route:${origin}-${destination}`], 'reset');
                }
            });
        });

        // Only show the plus button if all routes are complete or there are no routes
        const allRoutesComplete = appState.routeData.every(
            r => !r || r.isEmpty || (r.origin && r.destination)
        );
        
        if (appState.routeData.length === 0 || allRoutesComplete) {
            this.addPlusButton();
        }
    },

    updateTripButton(selectedRoutesArray) {
        // Group routes by their group ID to avoid counting segments multiple times
        const pricesByGroup = selectedRoutesArray.reduce((groups, item) => {
            const group = item.group;
            if (!groups[group]) {
                groups[group] = item.displayData.price;
            }
            return groups;
        }, {});

        // Sum up prices for each unique group
        let totalPrice = Object.values(pricesByGroup).reduce((total, price) => {
            const priceString = String(price).replace(/[^\d.-]/g, ''); // Extract price string conversion
            const numericPrice = typeof price === 'number' ? price : parseFloat(priceString);
            return total + (isNaN(numericPrice) ? 0 : numericPrice);
        }, 0);

        const tripButton = document.getElementById('tripButton');
        tripButton.textContent = totalPrice > 0 ? `$${totalPrice.toFixed(2)}` : '$0.00';
        tripButton.classList.add('green-button');
    },

    formatPrice(price) {
        return (typeof price === 'number' ? price : parseFloat(String(price).replace(/[^\d.-]/g, '')) || 0).toFixed(2);
    },

    highlightRoute(iataCodes, group) {
        iataCodes?.forEach((code, index) => {
            if (index < iataCodes.length - 1) {
                const routeId = `${iataCodes[index]}-${iataCodes[index + 1]}`;
                const filterTags = ['status:highlighted', `route:${routeId}`];
                if (group) filterTags.push(`group:${group}`);
                lineManager.getLinesByTags(filterTags, 'route').forEach(line => {
                    line.addTag('status:highlighted');
                    line.visibleLine.setStyle({ color: 'white' });
                });
            }
        });
    },

    addPlusButton() {
        const menuBar = document.getElementById('menu-bar');
        if (!document.getElementById('plus-button')) {
            let plusButton = document.createElement('button');
            plusButton.id = 'plus-button';
            plusButton.className = 'plus-button';
            // Replace the inline SVG with the add_circle.svg reference
            plusButton.innerHTML = `<img src="../assets/add_circle.svg" alt="Add route" width="20" height="20">`;
            plusButton.onclick = this.handlePlusButtonClick.bind(this);
            menuBar.appendChild(plusButton);
        }
    },

    handlePlusButtonClick(event) {
        // Get the last non-empty route
        const validRoutes = Object.entries(appState.routeData)
            .filter(([_, route]) => route && !route.isEmpty)
            .sort((a, b) => parseInt(a) - parseInt(b));
        
        // Find the index for the new route - next available after the existing routes
        let newRouteIndex = 0;
        if (validRoutes.length > 0) {
            newRouteIndex = parseInt(validRoutes[validRoutes.length - 1][0]) + 1;
        }
        
        // Track if we're auto-populating the origin
        let originAutoPopulated = false;
        
        // Create new route data structure for this route
        if (!appState.routeData[newRouteIndex]) {
            // Get previous route data if available
            const prevRouteIndex = newRouteIndex > 0 ? newRouteIndex - 1 : 0;
            const prevRoute = appState.routeData[prevRouteIndex];
            let originData = null;
            
            // Check if previous route is part of a multi-segment group
            const prevSelectedRoute = appState.routeData[prevRouteIndex];
            const isMultiSegment = prevSelectedRoute && prevSelectedRoute.group !== undefined;
            
            if (isMultiSegment) {
                // Find the last segment in this group to get the final destination
                const groupId = prevSelectedRoute.group;
                const groupSegments = Object.entries(appState.routeData)
                    .filter(([_, route]) => route.group === groupId)
                    .map(([idx, route]) => ({
                        index: parseInt(idx),
                        route: route
                    }))
                    .sort((a, b) => a.index - b.index);
                
                if (groupSegments.length > 0) {
                    const lastSegment = groupSegments[groupSegments.length - 1];
                    const lastSegmentRoute = lastSegment.route.displayData.route;
                    const finalDestIata = lastSegmentRoute.split(' > ')[1]; // Get destination part
                    
                    // Try to get detailed airport data
                    if (window.flightMap && window.flightMap.airportDataCache && finalDestIata) {
                        originData = window.flightMap.airportDataCache[finalDestIata] || { 
                            iata_code: finalDestIata,
                            city: finalDestIata
                        };
                        originAutoPopulated = true;
                    }
                }
            } 
            
            // If not part of multi-segment or we couldn't get the final destination,
            // fall back to the regular behavior
            if (!originData && prevRoute && prevRoute.destination) {
                // Make sure we have a complete object with all needed properties
                // This fixes issues where waypoints become incomplete
                originData = { 
                    ...prevRoute.destination,
                    isAnyDestination: false, 
                    isAnyOrigin: false 
                };
                
                // Make sure iata_code is preserved and not "Any"
                if (originData.iata_code === 'Any') {
                    originData = null;
                } else {
                    originAutoPopulated = true;
                }
            }
            
            // Calculate departure date (day after previous route's return or departure date)
            let departDate = new Date();
            if (prevRoute) {
                const baseDate = prevRoute.returnDate ? new Date(prevRoute.returnDate) : 
                                  prevRoute.departDate ? new Date(prevRoute.departDate) : new Date();
                if (!isNaN(baseDate)) {
                    departDate = baseDate;
                    departDate.setDate(departDate.getDate() + 1);
                }
            }
            
            // Format date as YYYY-MM-DD
            const formattedDate = departDate.toISOString().split('T')[0];
            
            // Create the new route data using updateRouteData
            updateState('updateRouteData', {
                routeNumber: newRouteIndex,
                data: {
                    tripType: 'oneWay', // Default to one-way
                    travelers: 1, // Default to 1 traveler
                    departDate: formattedDate,
                    returnDate: null,
                    origin: originData,
                    destination: null,
                    _originAutoPopulated: originAutoPopulated, // Flag to indicate origin was auto-populated
                    _destinationNeedsEmptyFocus: originAutoPopulated // Add this flag to indicate destination should be empty-focused
                }
            }, 'infoPane.handlePlusButtonClick');
        }

        // Set up the route box UI with the new route index
        setupRouteContent(newRouteIndex);

        // Explicitly force focus on the destination input if origin was auto-populated
        if (originAutoPopulated) {
            // Use setTimeout to ensure the DOM is ready
            setTimeout(() => {
                const destInput = document.getElementById(`waypoint-input-${newRouteIndex * 2 + 2}`);
                if (destInput) {
                    // Clear any pre-filled value before focusing
                    destInput.value = '';
                    destInput.readOnly = false;
                    destInput.focus();
                    
                    // Trigger the input event to show the suggestions
                    destInput.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }, 150);
        }
    },

    applyToLines(tags, action) {
        lineManager.getLinesByTags(tags).forEach(line => line[action]());
    },

    fitMapToRoute(routeIndex) {
        // Skip if map view changes are prevented
        if (appState.preventMapViewChange) {
            return;
        }
        
        // Get route data directly from routeData
        const routeData = appState.routeData[routeIndex];
        
        if (!routeData) return;
        
        let originWaypoint = routeData.origin;
        let destinationWaypoint = routeData.destination;
        
        // If either waypoint is missing or has iata_code=Any, don't adjust the map
        if (!originWaypoint || !destinationWaypoint || 
            originWaypoint.iata_code === 'Any' || destinationWaypoint.iata_code === 'Any') {
            return;
        }
        
        const points = [originWaypoint, destinationWaypoint]
            .filter(wp => wp && wp.latitude && wp.longitude);
        
        if (points.length < 2) return;

        // Check if route crosses the antimeridian
        const longitudes = points.map(point => point.longitude);
        const minLong = Math.min(...longitudes);
        const maxLong = Math.max(...longitudes);
        const spansDegrees = maxLong - minLong;
        const crossesAntimeridian = spansDegrees > 180;
        
        if (crossesAntimeridian) {
            // Adjust longitudes to be in the same hemisphere
            const adjustedLongitudes = longitudes.map(lng => {
                if (minLong < 0 && lng > 0) {
                    // If min is negative and this point is positive, make it negative
                    return lng - 360;
                } else if (minLong > 0 && lng < 0) {
                    // If min is positive and this point is negative, make it positive
                    return lng + 360;
                }
                return lng;
            });
            
            // Create the adjusted latLng points
            const adjustedPoints = points.map((point, idx) => 
                L.latLng(point.latitude, adjustedLongitudes[idx])
            );
            
            // Create a bounds object with adjusted coordinates
            const bounds = L.latLngBounds(adjustedPoints);
            map.fitBounds(bounds, { padding: [50, 50] });
        } else {
            // Standard bounds fitting for non-antimeridian crossing routes
            const group = points.map(point => L.latLng(point.latitude, point.longitude));
            map.fitBounds(L.latLngBounds(group), { padding: [50, 50] });
        }
    }
};

function setupRouteContent(routeIndex) {
    const infoPaneContent = document.getElementById('infoPaneContent');
    infoPaneContent.innerHTML = '';

    // Clear deck-specific lines when switching routes
    lineManager.clearLinesByTags(['type:deck']);

    // Remove active-route-button class from all buttons
    document.querySelectorAll('.route-info-button').forEach(button => {
        button.classList.remove('active-route-button');
    });

    // Add active-route-button class to the current button
    const currentButton = document.getElementById(`route-button-${routeIndex}`);
    if (currentButton) {
        currentButton.classList.add('active-route-button');
    }

    // Get route data from the routeData structure
    const routeData = appState.routeData[routeIndex];
    
    let contentWrapper;
    let routeBoxElement;

    const existingRouteTable = infoPane.routeDecks.get(routeIndex);

    if (existingRouteTable) {
        // Use cached route deck
        contentWrapper = existingRouteTable;
        infoPaneContent.appendChild(contentWrapper);

        // Restore filter states for this route
        const filterState = appState.filterStates[routeIndex] || {
            departure: { start: 0, end: 24 },
            arrival: { start: 0, end: 24 },
            price: { value: null }
        };
        appState.filterState = filterState; // Restore filter state

        // Restore filter thresholds for this route
        const filterThresholds = appState.filterThresholds[routeIndex] || {
            departure: { min: 0, max: 24 },
            arrival: { min: 0, max: 24 },
            price: { min: 0, max: 1000 }
        };
        appState.filterThresholds = filterThresholds; // Restore filter thresholds

        // Reapply filters to update line visibility
        applyFilters();

        // Get the routeBox if it exists in the cached content
        routeBoxElement = contentWrapper.querySelector('#routeBox');

        // If no routeBox exists, create one
        if (!routeBoxElement) {
            const routeBoxContainer = document.createElement('div');
            routeBoxContainer.id = 'routeBoxContainer';
            routeBoxElement = routeBox.createRouteBox();
            routeBoxElement.id = 'routeBox';
            routeBoxElement.dataset.routeNumber = routeIndex;

            routeBoxContainer.appendChild(routeBoxElement);
            contentWrapper.insertBefore(routeBoxContainer, contentWrapper.firstChild);

            // Setup the routeBox content
            routeBox.setupRouteBox(routeBoxElement, routeIndex);
        }
    } else {
        // Create new content
        contentWrapper = document.createElement('div');
        contentWrapper.className = 'content-wrapper';

        const routeBoxContainer = document.createElement('div');
        routeBoxContainer.id = 'routeBoxContainer';
        routeBoxElement = routeBox.createRouteBox();
        routeBoxElement.id = 'routeBox';
        routeBoxElement.dataset.routeNumber = routeIndex;

        routeBoxContainer.appendChild(routeBoxElement);
        contentWrapper.appendChild(routeBoxContainer);
        infoPaneContent.appendChild(contentWrapper);

        // Setup the routeBox content
        routeBox.setupRouteBox(routeBoxElement, routeIndex);
    }

    requestAnimationFrame(() => {
        const hasSearchResults = existingRouteTable?.querySelector('.route-info-deck');
        const routeBox = document.getElementById('routeBox');
        
        // Let the height manager calculate based on routeBox size
        infoPaneHeight.setHeight('content', {
            contentElement: routeBox
        });
    });

    appState.currentRouteIndex = routeIndex;
    applyFilters();

    return { contentWrapper, routeBoxElement };
}

export { infoPane, setupRouteContent };
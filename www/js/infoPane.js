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
            // Check if there are no routes or waypoints
            const hasNoRoutes = (
                Array.isArray(appState.routeData) && appState.routeData.length === 0 ||
                !appState.routeData || 
                Object.keys(appState.routeData).length === 0
            );
            
            const hasNoWaypoints = (
                !Array.isArray(appState.waypoints) || 
                appState.waypoints.length === 0 || 
                !appState.waypoints.some(wp => wp)
            );
            
            // Check URL for routes parameter
            const urlParams = new URLSearchParams(window.location.search);
            const hasRoutesInUrl = urlParams.has('routes');
            
            console.log("Initial load check - No routes:", hasNoRoutes, "No waypoints:", hasNoWaypoints, "Routes in URL:", hasRoutesInUrl);
            
            // Create initial routeBox if needed
            if (hasNoRoutes && hasNoWaypoints && !hasRoutesInUrl) {
                console.log("Creating initial routeBox");
                this.handlePlusButtonClick();
            } else if (hasRoutesInUrl && !document.querySelector('#routeBox')) {
                // If routes are in URL but no routeBox is displayed, show the first route
                console.log("Displaying first route from URL");
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
        //const infoPaneContent = document.getElementById('infoPaneContent'); //Unused variable
        //const routeBox = document.getElementById('routeBox'); //Unused variable
        //const currentView = appState.currentView; //Unused variable
    },

    // Add the missing handleRouteButtonClick method
    handleRouteButtonClick(routeIndex) {
        // Check if this is a selected route
        if (appState.selectedRoutes[routeIndex]) {
            // This is a selected route - display the selected route info
            import('./routeDeck/selectedRoute.js').then(({ selectedRoute }) => {
                selectedRoute.displaySelectedRouteInfo(routeIndex);
            });
        } else {
            // This is not a selected route - use standard setupRouteContent
            setupRouteContent(routeIndex);
        }
    },

    updateRouteButtons() {
        const menuBar = document.getElementById('menu-bar');
        menuBar.innerHTML = '';

        // Create a set of all selected route indices to check against
        const selectedRouteIndices = new Set();
        
        // Include all segment indices that are part of a selected route group
        Object.entries(appState.selectedRoutes).forEach(([index, route]) => {
            selectedRouteIndices.add(parseInt(index));
            
            // If this segment belongs to a group, find all segments with the same group
            if (route.group !== undefined) {
                Object.entries(appState.selectedRoutes).forEach(([otherIndex, otherRoute]) => {
                    if (otherRoute.group === route.group) {
                        selectedRouteIndices.add(parseInt(otherIndex));
                    }
                });
            }
        });

        // Collect all route indices we need to display buttons for
        const routeIndices = new Set();
        
        // First add indices from routeData
        for (let i = 0; i < appState.routeData.length; i++) {
            const routeData = appState.routeData[i];
            if (routeData && !routeData.isEmpty) {
                routeIndices.add(i);
            }
        }
        
        // Then add indices from selectedRoutes that might not be in routeData
        Object.keys(appState.selectedRoutes).forEach(index => {
            routeIndices.add(parseInt(index));
        });
        
        // Sort indices to maintain consistent button order
        const sortedIndices = Array.from(routeIndices).sort((a, b) => a - b);
        
        console.log("Creating route buttons for indices:", sortedIndices);
        console.log("Selected route indices:", Array.from(selectedRouteIndices));
        
        // Create buttons for all routes in our combined set
        for (const routeIndex of sortedIndices) {
            // Get route data - first try routeData, then fall back to selectedRoutes
            const routeData = appState.routeData[routeIndex];
            const selectedRoute = appState.selectedRoutes[routeIndex];
            
            // Skip empty routes with no selected route
            if ((!routeData || routeData.isEmpty) && !selectedRoute) {
                continue;
            }
            
            const buttonId = `route-button-${routeIndex}`;
            let button = document.getElementById(buttonId) || document.createElement('button');
            
            // Get origin and destination - first try routeData, then fall back to selectedRoute
            let origin, destination;
            
            if (routeData && !routeData.isEmpty) {
                // Use data from routeData
                origin = routeData.origin?.iata_code;
                destination = routeData.destination?.iata_code;
            } else if (selectedRoute) {
                // Fall back to selectedRoute data
                const routeParts = selectedRoute.displayData?.route?.split(' > ') || [];
                origin = routeParts[0];
                destination = routeParts[1];
            } else {
                // Skip if we can't determine origin/destination
                continue;
            }
            
            // Skip if both origin and destination are missing
            if (!origin && !destination) continue;
            
            // Create or update button
            if (!button.id) {
                button.id = buttonId;
                button.className = 'route-info-button';
                
                // Add even-button class to alternate gradient directions
                if (routeIndex % 2 === 1) {
                    button.classList.add('even-button');
                }
                
                menuBar.appendChild(button);
            }
            
            // Clear previous content and add structured elements for origin and destination
            button.innerHTML = '';
            
            // Create origin element (upper left)
            const originElement = document.createElement('span');
            originElement.className = 'origin-iata';
            originElement.textContent = origin || 'Any';
            
            // Add special styling for "Any" origins
            if (origin === 'Any' || !origin) {
                originElement.classList.add('any-waypoint');
            }
            
            button.appendChild(originElement);
            
            // Create destination element (lower right)
            const destElement = document.createElement('span');
            destElement.className = 'dest-iata';
            destElement.textContent = destination || 'Any';
            
            // Add special styling for "Any" destinations
            if (destination === 'Any' || !destination) {
                destElement.classList.add('any-waypoint');
            }
            
            button.appendChild(destElement);
            
            // Use the method reference for the click handler
            button.onclick = () => this.handleRouteButtonClick(routeIndex);

            // Only fit map to route if we're not preventing map view changes
            if (!appState.preventMapViewChange) {
                this.fitMapToRoute(routeIndex);
            }

            // Check if this route index is in our set of selected routes
            // This ensures all segments in a multi-segment route are properly marked
            if (selectedRouteIndices.has(routeIndex)) {
                button.classList.add('selected-route-button');
            } else {
                button.classList.remove('selected-route-button');
            }
            
            // Get date range from the best available source
            let dateRange;
            if (routeData && !routeData.isEmpty) {
                dateRange = { 
                    depart: routeData.departDate,
                    return: routeData.returnDate
                };
            } else if (selectedRoute) {
                dateRange = selectedRoute.routeDates || {
                    depart: selectedRoute.displayData?.departure,
                    return: selectedRoute.displayData?.arrival
                };
            }
                
            if (dateRange) {
                uiHandling.attachDateTooltip(button, routeIndex, dateRange);
            }

            // Use a single event listener for both mouseover and mouseout
            button.addEventListener('mouseover', () => {
                // Only highlight if neither origin nor destination is "Any"
                if (origin && destination && origin !== 'Any' && destination !== 'Any') {
                    this.applyToLines([`route:${origin}-${destination}`], 'highlight');
                }
            });
            button.addEventListener('mouseout', () => {
                if (origin && destination && origin !== 'Any' && destination !== 'Any') {
                    this.applyToLines([`route:${origin}-${destination}`], 'reset');
                }
            });
        }

        // Add plus button if appropriate - now check both structures
        const allRoutesComplete = Object.values(appState.routeData).every(
            r => !r || r.isEmpty || (r.origin && r.destination)
        );
        
        if (sortedIndices.length === 0 || allRoutesComplete) {
            this.addPlusButton();
        }
    },

    updateTripDeck(selectedRoutesArray) {
        const infoPaneContent = document.getElementById('infoPaneContent');
        infoPaneContent.innerHTML = '';

        const deck = document.createElement('deck');
        deck.className = 'route-info-deck';
        deck.innerHTML = `<thead><tr><th>Departure</th><th>Arrival</th><th>Price</th><th>Airline</th><th>Stops</th><th>Route</th><th>Action</th></tr></thead>`;

        const tbody = document.createElement('tbody');
        const fragment = document.createDocumentFragment(); // Create a fragment

        let groupData = this.aggregateGroupData(selectedRoutesArray);

        Object.values(groupData).forEach(data => {
            const { formattedDeparture, formattedArrival, price, deep_link, route, group } = this.formatRowData(data);
            const row = document.createElement('tr');
            row.innerHTML = `<td>${formattedDeparture}</td><td>${formattedArrival}</td><td>${price}</td><td>${data.airlines.join(', ')}</td><td>${data.stops.size}</td><td>${route.join(' > ')}</td><td><a href="${deep_link}" target="_blank"><button>Book Flight</button></a></td>`;
            row.addEventListener('mouseover', () => this.highlightRoute(data.route, group));
            row.addEventListener('mouseout', () => lineManager.clearLinesByTags(['status:highlighted']));
            fragment.appendChild(row); // Append to the fragment
        });

        deck.appendChild(fragment); // Append the entire fragment to tbody
        infoPaneContent.appendChild(deck);
        this.updateTripButton(selectedRoutesArray);
    },

    aggregateGroupData(selectedRoutesArray) {
        return selectedRoutesArray.reduce((groupData, item, index) => {
            const group = item.group;
            const routeParts = item.displayData.route.split(' > '); // Extract route parts
            
            // Get route data for more consistent date access
            const routeData = appState.routeData[item.routeNumber];
            
            if (!groupData[group]) {
                groupData[group] = {
                    departure: routeData?.departDate,
                    arrival: routeData?.returnDate,
                    price: item.displayData.price,
                    airlines: [item.displayData.airline],
                    stops: new Set(),
                    route: [routeParts[0]], // Use extracted route parts
                    deep_link: item.displayData.deep_link
                };
            } else {
                groupData[group].arrival = routeData?.returnDate;
                groupData[group].airlines.push(item.displayData.airline);
            }
            groupData[group].route.push(routeParts[1]); // Use extracted route parts
            if (index > 0) {
                groupData[group].stops.add(routeParts[0]); // Use extracted route parts
            }
            return groupData;
        }, {});
    },

    formatRowData(data) {
        const departureDate = new Date(data.departure);
        const arrivalDate = new Date(data.arrival);
        const formattedDeparture = `${departureDate.toLocaleDateString('en-US', { weekday: 'short' })} ${departureDate.toLocaleDateString('en-US')}`;
        const formattedArrival = `${arrivalDate.toLocaleDateString('en-US', { weekday: 'short' })} ${arrivalDate.toLocaleDateString('en-US')}`;
        const price = this.formatPrice(data.price);
        return { formattedDeparture, formattedArrival, price, deep_link: data.deep_link, route: data.route, group: data.group };
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
        
        // Create new route data structure for this route
        if (!appState.routeData[newRouteIndex]) {
            // Get previous route data if available
            const prevRouteIndex = newRouteIndex > 0 ? newRouteIndex - 1 : 0;
            const prevRoute = appState.routeData[prevRouteIndex];
            
            // Initialize with destination from previous route as origin if applicable
            const origin = prevRoute && prevRoute.destination && prevRoute.destination.iata_code !== 'Any' 
                ? { ...prevRoute.destination, isAnyDestination: false, isAnyOrigin: false }
                : null;
            
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
            
            // Create the new route data
            appState.routeData[newRouteIndex] = {
                tripType: 'oneWay', // Default to one-way
                travelers: 1, // Default to 1 traveler
                departDate: formattedDate,
                returnDate: null,
                origin: origin,
                destination: null
            };
            
            // Update waypoints for backward compatibility
            if (origin) {
                updateState('updateWaypoint', { 
                    index: newRouteIndex * 2, 
                    data: origin 
                }, 'infoPane.handlePlusButtonClick');
            }
            
            // Update route dates for backward compatibility
            updateState('updateRouteDate', {
                routeNumber: newRouteIndex,
                depart: formattedDate,
                return: null
            }, 'infoPane.handlePlusButtonClick');
        }

        // Set up the route box UI with the new route index
        setupRouteContent(newRouteIndex);
    },

    applyToLines(tags, action) {
        lineManager.getLinesByTags(tags).forEach(line => line[action]());
    },

    fitMapToRoute(routeIndex) {
        // Skip if map view changes are prevented
        if (appState.preventMapViewChange) {
            console.log("Map view change prevented by flag");
            return;
        }
        
        // Try to get route data from either routeData or selectedRoutes
        const routeData = appState.routeData[routeIndex];
        const selectedRoute = appState.selectedRoutes[routeIndex];
        
        if (!routeData && !selectedRoute) return;
        
        let originWaypoint, destinationWaypoint;
        
        if (routeData && !routeData.isEmpty) {
            // Get waypoints from routeData - this is the preferred source
            originWaypoint = routeData.origin;
            destinationWaypoint = routeData.destination;
        } else if (selectedRoute && selectedRoute.displayData) {
            // Try to get waypoints from selectedRoute
            const route = selectedRoute.displayData.route.split(' > ');
            if (route.length >= 2) {
                // We just have IATA codes here, not full waypoint objects
                // We'll need to fetch the airport data
                originWaypoint = { iata_code: route[0] };
                destinationWaypoint = { iata_code: route[1] };
                
                // Try to get airport data from airportDataCache if available
                if (window.flightMap && window.flightMap.airportDataCache) {
                    if (window.flightMap.airportDataCache[originWaypoint.iata_code]) {
                        originWaypoint = window.flightMap.airportDataCache[originWaypoint.iata_code];
                    }
                    if (window.flightMap.airportDataCache[destinationWaypoint.iata_code]) {
                        destinationWaypoint = window.flightMap.airportDataCache[destinationWaypoint.iata_code];
                    }
                }
            }
        }
        
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

// Remove the redundant event listeners since we now handle this in the infoPane object
// document.querySelectorAll('.routeButton').forEach(button => {
//     button.addEventListener('click', handleRouteButtonClick);
// });

// Keep this function but remove the duplicate event binding
function handleRouteButtonClick(event) {
    const routeIndex = parseInt(event.target.dataset.routeIndex, 10);
    setupRouteContent(routeIndex);
}

function setupRouteContent(routeIndex) {
    const infoPaneElement = document.getElementById('infoPane');
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

    // Check if this is a selected route segment without corresponding routeData
    const selectedRouteData = appState.selectedRoutes[routeIndex];
    if (selectedRouteData && (!appState.routeData[routeIndex] || appState.routeData[routeIndex].isEmpty)) {
        // This is a segment of a multi-segment route that doesn't have routeData
        // Extract route information from the selectedRoute to create routeData
        const routeParts = selectedRouteData.displayData.route.split(' > ');
        if (routeParts.length === 2) {
            const origin = routeParts[0];
            const destination = routeParts[1];
            
            // Get airport data if available in the cache
            let originData = null;
            let destinationData = null;
            
            if (window.flightMap && window.flightMap.airportDataCache) {
                originData = window.flightMap.airportDataCache[origin] || { iata_code: origin, city: origin };
                destinationData = window.flightMap.airportDataCache[destination] || { iata_code: destination, city: destination };
            } else {
                originData = { iata_code: origin, city: origin };
                destinationData = { iata_code: destination, city: destination };
            }
            
            // Create routeData for this segment
            appState.routeData[routeIndex] = {
                tripType: 'oneWay', // Default for segments
                travelers: 1, // Default value
                departDate: selectedRouteData.displayData.departure,
                returnDate: null,
                origin: originData,
                destination: destinationData,
                isSegment: true // Mark this as a segment for special handling
            };
            
            // Add to waypoints array for backwards compatibility
            while (appState.waypoints.length <= (routeIndex * 2 + 1)) {
                appState.waypoints.push(null);
            }
            appState.waypoints[routeIndex * 2] = originData;
            appState.waypoints[routeIndex * 2 + 1] = destinationData;
            
            // Update route dates
            updateState('updateRouteDate', {
                routeNumber: routeIndex,
                depart: selectedRouteData.displayData.departure,
                return: null
            }, 'setupRouteContent');
            
            console.log(`Created routeData for segment ${routeIndex}:`, appState.routeData[routeIndex]);
        }
    }

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
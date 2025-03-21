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
        
        // Check if URL contains waypoints parameter
        const urlParams = new URLSearchParams(window.location.search);
        const hasWaypointsInUrl = urlParams.has('waypoints');
        
        // Only trigger plus button click if there are no waypoints and no waypoints in URL
        if (appState.waypoints.length === 0 && !hasWaypointsInUrl) {
            this.handlePlusButtonClick();
        }
    },

    handleTripButtonClick() {
        appState.currentView = 'trip';
        this.displayContent();

        const waypointsLatLng = appState.waypoints.map(({ latitude, longitude }) => [latitude, longitude]);

        if (waypointsLatLng.length > 0) {
            map.fitBounds(L.latLngBounds(waypointsLatLng), { padding: [50, 50] });
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

    updateRouteButtons() {
        const menuBar = document.getElementById('menu-bar');
        menuBar.innerHTML = '';

        appState.waypoints.forEach((_, index) => {
            const routeIndex = Math.floor(index / 2);
            const buttonId = `route-button-${routeIndex}`;
            let button = document.getElementById(buttonId) || document.createElement('button');
            const origin = appState.waypoints[routeIndex * 2]?.iata_code || 'Any';
            const destination = appState.waypoints[routeIndex * 2 + 1]?.iata_code || 'Any';
            
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
            originElement.textContent = origin;
            
            // Add special styling for "Any" origins
            if (origin === 'Any') {
                originElement.classList.add('any-waypoint');
            }
            
            button.appendChild(originElement);
            
            // Create destination element (lower right)
            const destElement = document.createElement('span');
            destElement.className = 'dest-iata';
            destElement.textContent = destination;
            
            // Add special styling for "Any" destinations
            if (destination === 'Any') {
                destElement.classList.add('any-waypoint');
            }
            
            button.appendChild(destElement);
            
            button.onclick = this.handleRouteButtonClick.bind(this, routeIndex);

            // Only fit map to route if we're not preventing map view changes
            if (!appState.preventMapViewChange) {
                this.fitMapToRoute(routeIndex);
            }

            // Ensure selected button class is applied while maintaining the even-button class if needed
            if (appState.selectedRoutes.hasOwnProperty(routeIndex)) {
                button.classList.add('selected-route-button');
            } else {
                button.classList.remove('selected-route-button');
            }

            uiHandling.attachDateTooltip(button, routeIndex);

            // Use a single event listener for both mouseover and mouseout
            button.addEventListener('mouseover', () => {
                // Only highlight if neither origin nor destination is "Any"
                if (origin !== 'Any' && destination !== 'Any') {
                    this.applyToLines([`route:${origin}-${destination}`], 'highlight');
                }
            });
            button.addEventListener('mouseout', () => {
                if (origin !== 'Any' && destination !== 'Any') {
                    this.applyToLines([`route:${origin}-${destination}`], 'reset');
                }
            });
        });

        if (appState.waypoints.length === 0 || appState.waypoints.length % 2 === 0) {
            this.addPlusButton();
        }
    },

    handleRouteButtonClick(routeIndex, event) {
        event.stopPropagation();

        // Set a flag to prevent line clearing during route switching
        appState.isRouteSwitching = true;

        // Simplify height check and collapse logic
        if (routeIndex === appState.currentRouteIndex &&
            document.getElementById('infoPane').offsetHeight > infoPaneHeight.MENU_BAR_HEIGHT) {
            infoPaneHeight.setHeight('collapse');
            appState.isRouteSwitching = false; // Reset flag
            return;
        }

        // Check if this is a selected route
        if (appState.selectedRoutes[routeIndex]) {
            // Import the selectedRoute module if not already imported
            import('./routeDeck/selectedRoute.js').then(({ selectedRoute }) => {
                // Don't need to call setupRouteContent first, let the selectedRoute module handle it
                selectedRoute.displaySelectedRouteInfo(routeIndex);
                this.fitMapToRoute(routeIndex);
            });
        } else {
            // Only call setupRouteContent for non-selected routes
            const { routeBoxElement } = setupRouteContent(routeIndex);
            this.fitMapToRoute(routeIndex);
        }
        
        // Reset the flag after a short delay to allow for inputs to initialize
        setTimeout(() => {
            appState.isRouteSwitching = false;
        }, 500);
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
            if (!groupData[group]) {
                groupData[group] = {
                    departure: appState.routeDates[item.routeNumber]?.depart,
                    arrival: appState.routeDates[item.routeNumber]?.return,
                    price: item.displayData.price,
                    airlines: [item.displayData.airline],
                    stops: new Set(),
                    route: [routeParts[0]], // Use extracted route parts
                    deep_link: item.displayData.deep_link
                };
            } else {
                groupData[group].arrival = appState.routeDates[item.routeNumber]?.return;
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
        if (appState.waypoints.length > 0) {
            updateState('addWaypoint', { ...appState.waypoints.at(-1) }, 'infoPane.handlePlusButtonClick');

            const routeIndex = appState.routes.length - 1;
            const prevDates = appState.routeDates[routeIndex] || {};

            const baseDate = new Date(prevDates.return || prevDates.depart || Date.now());
            const newDate = !isNaN(baseDate) ? baseDate : new Date();
            newDate.setDate(newDate.getDate() + 1);

            const formattedDate =
                newDate.getFullYear() + '-' +
                String(newDate.getMonth() + 1).padStart(2, '0') + '-' +
                String(newDate.getDate()).padStart(2, '0');

            updateState('updateRouteDate', {
                routeNumber: routeIndex + 1,
                depart: formattedDate,
                return: null
            }, 'infoPane.handlePlusButtonClick');
        }

        setupRouteContent(appState.routes.length);
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
        
        const [originWaypoint, destinationWaypoint] = [
            appState.waypoints[routeIndex * 2],
            appState.waypoints[routeIndex * 2 + 1]
        ];
        
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

document.querySelectorAll('.routeButton').forEach(button => {
    button.addEventListener('click', handleRouteButtonClick);
});

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
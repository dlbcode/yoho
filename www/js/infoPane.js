import { appState, updateState } from './stateManager.js';
import { pathDrawing } from './pathDrawing.js';
import { buildRouteTable } from './routeTable/routeTable.js';
import { selectedRoute } from './routeTable/selectedRoute.js';
import { adjustMapSize, map } from './map.js';
import { uiHandling } from './uiHandling.js';
import { flightMap } from './flightMap.js';
import { routeBox } from './routeBox/routeBox.js';
import { lineManager } from './lineManager.js';

const infoPane = {
    init() {
        const infoPaneContent = document.getElementById('infoPaneContent');
        const tripButton = document.getElementById('tripButton');
        document.addEventListener('stateChange', this.handleStateChange.bind(this));

        tripButton.addEventListener('click', () => {
            appState.currentView = 'trip';
            this.displayContent();

            const waypointsLatLng = appState.waypoints.map(waypoint => [waypoint.latitude, waypoint.longitude]);

            if (waypointsLatLng.length > 0) {
                const bounds = L.latLngBounds(waypointsLatLng);
                map.fitBounds(bounds, { padding: [50, 50] }); // Adjust padding as needed
            }
        });
        this.addPlusButton();
    },

    handleStateChange(event) {
        this.updateRouteButtons();
        if (event.detail.key === 'updateSelectedRoute' || event.detail.key === 'removeSelectedRoute' || event.detail.key === 'changeView' || event.detail.key === 'updateRoutes') {
            this.displayContent();
        }
    },

    displayContent() {
        const infoPaneContent = document.getElementById('infoPaneContent');
        infoPaneContent.innerHTML = '';

        const { currentView, currentRouteIndex, selectedRoutes } = appState;

        if (currentView === 'trip') {
            this.updateTripTable(Object.values(selectedRoutes));
        } else if (currentView === 'routeTable') {
            buildRouteTable(currentRouteIndex);
        } else if (currentView === 'selectedRoute') {
            if (selectedRoutes[currentRouteIndex] !== undefined) {
                selectedRoute.displaySelectedRouteInfo(currentRouteIndex);
            } else {
                appState.currentView = 'trip';
                this.displayContent();
            }
        }
    },

    updateRouteButtons() {
        const menuBar = document.getElementById('menu-bar');
        menuBar.innerHTML = ''; // Clear existing buttons

        appState.waypoints.forEach((waypoint, index) => {
            const routeIndex = Math.floor(index / 2);
            const buttonId = `route-button-${routeIndex}`;
            let button = document.getElementById(buttonId);

            const origin = appState.waypoints[routeIndex * 2] ? appState.waypoints[routeIndex * 2].iata_code : 'Any';
            const destination = appState.waypoints[routeIndex * 2 + 1] ? appState.waypoints[routeIndex * 2 + 1].iata_code : 'Any';
            const buttonText = `${origin}-${destination}`;

            if (!button) {
                button = document.createElement('button');
                button.id = buttonId;
                button.className = 'route-info-button';
                menuBar.appendChild(button);
                button.textContent = buttonText; // Ensure text is set
            }

            button.textContent = buttonText;

            button.onclick = (event) => {
                adjustMapSize();
                if (appState.currentRouteIndex != routeIndex) {
                    appState.currentRouteIndex = routeIndex;
                    if (appState.selectedRoutes.hasOwnProperty(routeIndex)) {
                        console.log('Selected route clicked');
                        appState.currentView = 'selectedRoute';
                    } else {
                        console.log('Route clicked');
                        routeBox.showRouteBox(event, routeIndex);
                    }
                    this.displayContent();
                } else {
                    if (document.getElementById('routeBox').style.display === 'none') {
                        routeBox.showRouteBox(event, routeIndex);
                    } else {
                        document.getElementById('routeBox').style.display = 'none';
                    }
                }

                // Correctly calculate bounds based on the current waypoints for zooming
                const originWaypoint = appState.waypoints[routeIndex * 2];
                const destinationWaypoint = appState.waypoints[routeIndex * 2 + 1];
                const group = [originWaypoint, destinationWaypoint].filter(wp => wp).map(airport => L.latLng(airport.latitude, airport.longitude));
                const bounds = L.latLngBounds(group);
                if (group.length > 1) {
                    map.fitBounds(bounds, { padding: [50, 50] });
                } else if (group.length === 1) {
                    map.setView(group[0], 4);
                }
            };

            if (appState.selectedRoutes.hasOwnProperty(routeIndex)) {
                button.classList.add('selected-route-button'); // Adds a class that you will style to make the background green
            } else {
                button.classList.remove('selected-route-button'); // Removes the class, returning to the default style
            }

            uiHandling.attachDateTooltip(button, routeIndex);

            button.addEventListener('mouseover', () => {
                const routeId = `${origin}-${destination}`;
                const lineSets = pathDrawing.routePathCache[routeId] || pathDrawing.dashedRoutePathCache[routeId] || [];
                lineSets.forEach(lineSet => {
                    if (lineSet && lineSet.lines) {
                        lineSet.lines.forEach(linePair => {
                            if (linePair.visibleLine) {
                                linePair.visibleLine.setStyle({ color: 'white' });
                            }
                        });
                    }
                });
            });

            button.addEventListener('mouseout', () => {
                const routeId = `${origin}-${destination}`;
                const lineSets = pathDrawing.routePathCache[routeId] || [];
                const dashedLineSets = pathDrawing.dashedRoutePathCache[routeId] || [];

                // Fix: Update for dashedLineSets
                dashedLineSets.forEach(line => {
                    if (line && line.visibleLine) {
                        line.visibleLine.setStyle({ color: '#999' });
                    }
                });

                // Fix: Update for regular lineSets 
                lineSets.forEach(line => {
                    if (line && line.visibleLine) {
                        const color = line.visibleLine.options.originalColor || 'grey';
                        line.visibleLine.setStyle({ color: color });
                    }
                });
            });
        });
        if (appState.waypoints.length === 0 || appState.waypoints.length % 2 === 0) {
            this.addPlusButton();
        }
    },

    updateTripTable: function (selectedRoutesArray) {
        const infoPaneContent = document.getElementById('infoPaneContent');
        infoPaneContent.innerHTML = ''; // Clear existing content

        const table = document.createElement('table');
        table.className = 'route-info-table';

        const thead = document.createElement('thead');
        thead.innerHTML = `<tr>
            <th>Departure</th>
            <th>Arrival</th>
            <th>Price</th>
            <th>Airline</th>
            <th>Stops</th>
            <th>Route</th>
            <th>Action</th>
        </tr>`;
        table.appendChild(thead);

        const tbody = document.createElement('tbody');

        // Aggregate data for each group
        let groupData = {};
        selectedRoutesArray.forEach((item, index) => {
            const group = item.group;
            if (!groupData[group]) {
                groupData[group] = {
                    departure: appState.routeDates[item.routeNumber]?.depart, // Access new routeDates structure
                    arrival: appState.routeDates[item.routeNumber]?.return, // Access new routeDates structure
                    price: item.displayData.price,
                    airlines: [item.displayData.airline],
                    stops: new Set(), // Use a Set to ensure unique stops
                    route: [item.displayData.route.split(' > ')[0]], // Initialize with origin
                    deep_link: item.displayData.deep_link
                };
            } else {
                groupData[group].arrival = appState.routeDates[item.routeNumber]?.return; // Update to last route's arrival
                groupData[group].airlines.push(item.displayData.airline);
            }
            // Always add the destination to the route
            groupData[group].route.push(item.displayData.route.split(' > ')[1]);

            // Add each stop to the Set, excluding the first origin and the last destination later
            if (index > 0) { // Exclude the very first origin
                groupData[group].stops.add(item.displayData.route.split(' > ')[0]);
            }
        });

        // Create table rows for each group
        Object.values(groupData).forEach(data => {
            // Format departure and arrival dates to include the short day name
            const departureDate = new Date(data.departure);
            const arrivalDate = new Date(data.arrival);
            const departureDayName = departureDate.toLocaleDateString('en-US', { weekday: 'short' });
            const arrivalDayName = arrivalDate.toLocaleDateString('en-US', { weekday: 'short' });
            const price = this.formatPrice(data.price);

            const formattedDeparture = `${departureDayName} ${departureDate.toLocaleDateString('en-US')}`;
            const formattedArrival = `${arrivalDayName} ${arrivalDate.toLocaleDateString('en-US')}`;

            const row = document.createElement('tr');
            row.innerHTML = `<td>${formattedDeparture}</td>
                <td>${formattedArrival}</td>
                <td>${price}</td>
                <td>${data.airlines.join(', ')}</td>
                <td>${data.stops.size}</td>
                <td>${data.route.join(' > ')}</td>
                <td><a href="${data.deep_link}" target="_blank"><button>Book Flight</button></a></td>`;

            row.addEventListener('mouseover', function () {
                const routeString = data.route.join(' > ');
                const iataCodes = routeString.split(' > ');
                infoPane.highlightRoute(iataCodes, data.group);
            });

            // Attach mouseout event to clear the route
            row.addEventListener('mouseout', function () {
                lineManager.clearLinesByTags(['status:highlighted']);
            });

            tbody.appendChild(row);
        });

        table.appendChild(tbody);
        infoPaneContent.appendChild(table);

        // Update the trip button with total price
        let totalPrice = 0; // Initialize total price for all routes
        let processedGroups = new Set(); // Set to track which groups have been processed

        selectedRoutesArray.forEach(item => {
            // Only add price if this group has not been processed yet
            if (!processedGroups.has(item.group)) {
                processedGroups.add(item.group); // Mark this group as processed
                
                // Handle different price formats
                let price = 0;
                if (typeof item.displayData.price === 'number') {
                    price = item.displayData.price;
                } else if (typeof item.displayData.price === 'string') {
                    price = parseFloat(item.displayData.price.replace(/[^\d.-]/g, ''));
                }
                
                // Add valid price to total
                if (!isNaN(price)) {
                    totalPrice += price;
                }
            }
        });

        // Update button with formatted total
        const tripButton = document.getElementById('tripButton');
        tripButton.textContent = totalPrice > 0 ? `$${totalPrice.toFixed(2)}` : '$0.00';
        tripButton.classList.add('green-button');
        if (tripButton && appState.selectedRoutes.length > 0) {
            tripButton.addEventListener('mouseover', function () {
                const allIataCodes = [];
                const tableRows = document.querySelectorAll('.route-info-table tbody tr');
                tableRows.forEach(row => {
                    const routeString = row.cells[5].textContent.trim(); // Adjust the index based on the 'Route' column in your table
                    const iataCodes = routeString.split(' > ');
                    allIataCodes.push(...iataCodes);
                });
                infoPane.highlightRoute(allIataCodes);
            });

            tripButton.addEventListener('mouseout', function () {
                lineManager.clearLinesByTags(['status:highlighted']);
            });
        }
    },

    formatPrice: function (price) {
        // Handle price if it's already a number
        if (typeof price === 'number') {
            return price.toFixed(2);
        }
        // Handle string price
        if (typeof price === 'string') {
            const numericPrice = parseFloat(price.replace(/[^\d.-]/g, ''));
            return isNaN(numericPrice) ? "0.00" : numericPrice.toFixed(2);
        }
        // Handle undefined/null/invalid input
        return "0.00";
    },

    highlightRoute: function (iataCodes, group) {
        // Add 'status:highlighted' tag to matching lines
        if (iataCodes) {
            iataCodes.forEach((code, index) => {
                if (index < iataCodes.length - 1) {
                    const routeId = `${iataCodes[index]}-${iataCodes[index + 1]}`;
                    const filterTags = ['status:highlighted', `route:${routeId}`];
                    if (group) {
                        filterTags.push(`group:${group}`);
                    }
                    const linesToHighlight = lineManager.getLinesByTags(filterTags, 'route');
                    linesToHighlight.forEach(line => {
                        line.addTag('status:highlighted');
                        line.visibleLine.setStyle({ color: 'white' });
                    });
                }
            });
        }
    },

    addPlusButton() {
        const menuBar = document.getElementById('menu-bar');
        const routeIndex = Math.floor(appState.routes.length);
        if (!document.getElementById('plus-button')) { // Check to avoid duplicates
            let plusButton = document.createElement('button');
            plusButton.id = 'plus-button';
            plusButton.className = 'plus-button';
            plusButton.onclick = (event) => {
                // Duplicate the last waypoint as the default origin for the new route
                if (appState.waypoints.length > 0) {
                    const lastWaypoint = appState.waypoints[appState.waypoints.length - 1];
                    const newWaypoint = { ...lastWaypoint }; // Create a copy of the last waypoint
                    updateState('addWaypoint', newWaypoint, 'infoPane.addPlusButton'); // Use updateState to add the duplicated waypoint
                    // set the new depart date to the last return date, if it exists, or the last depart date
                    const lastDepartDate = appState.routeDates[appState.routes.length - 1]?.depart;
                    const lastReturnDate = appState.routeDates[appState.routes.length - 1]?.return;
                    let newDepartDate = lastReturnDate || lastDepartDate;
                    newDepartDate = new Date(newDepartDate);
                    newDepartDate.setDate(newDepartDate.getDate() + 1);
                    newDepartDate = newDepartDate.toISOString().slice(0, 10);
                    updateState('updateRouteDate', { routeNumber: appState.routes.length, depart: newDepartDate }, 'infoPane.addPlusButton');
                }
                routeBox.showRouteBox(event, routeIndex);
            };

            // Create the SVG as a string and set it as the innerHTML of the button
            plusButton.innerHTML = `
                <svg height="32px" width="32px" viewBox="0 0 64 64" fill="#aaa">
                    <rect x="30" y="10" width="4" height="44"></rect>
                    <rect x="10" y="30" width="44" height="4"></rect>
                </svg>
            `;

            menuBar.appendChild(plusButton);
        }
    }

}

export { infoPane };
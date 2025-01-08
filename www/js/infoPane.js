import { appState, updateState } from './stateManager.js';
import { pathDrawing } from './pathDrawing.js';
import { buildRouteTable } from './routeTable/routeTable.js';
import { selectedRoute } from './routeTable/selectedRoute.js';
import { adjustMapSize, map } from './map.js';
import { uiHandling } from './uiHandling.js';
import { flightMap } from './flightMap.js';
import { routeBox } from './routeBox/routeBox.js';
import { lineManager } from './lineManager.js';

function getEl(id) {
    return document.getElementById(id);
}

const infoPane = {
    init() {
        const tripButton = getEl('tripButton');
        document.addEventListener('stateChange', this.handleStateChange.bind(this));

        tripButton.addEventListener('click', () => {
            appState.currentView = 'trip';
            this.displayContent();
            const waypointsLatLng = appState.waypoints.map(wp => [wp.latitude, wp.longitude]);
            if (waypointsLatLng.length > 0) {
                const bounds = L.latLngBounds(waypointsLatLng);
                map.fitBounds(bounds, { padding: [50, 50] });
            }
        });
        this.addPlusButton();
    },

    handleStateChange(event) {
        const keysToDisplay = ['updateSelectedRoute', 'removeSelectedRoute', 'changeView', 'updateRoutes'];
        this.updateRouteButtons();
        if (keysToDisplay.includes(event.detail.key)) {
            this.displayContent();
        }
    },

    displayContent() {
        const infoPaneContent = getEl('infoPaneContent');
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
        const menuBar = getEl('menu-bar');
        menuBar.innerHTML = '';

        appState.waypoints.forEach((waypoint, index) => {
            const routeIndex = Math.floor(index / 2);
            const buttonId = `route-button-${routeIndex}`;
            let button = getEl(buttonId);

            const origin = appState.waypoints[routeIndex * 2] ? appState.waypoints[routeIndex * 2].iata_code : 'Any';
            const destination = appState.waypoints[routeIndex * 2 + 1] ? appState.waypoints[routeIndex * 2 + 1].iata_code : 'Any';
            const buttonText = `${origin}-${destination}`;

            if (!button) {
                button = document.createElement('button');
                button.id = buttonId;
                button.className = 'route-info-button';
                menuBar.appendChild(button);
            }
            button.textContent = buttonText;

            button.onclick = (event) => {
                adjustMapSize();
                if (appState.currentRouteIndex !== routeIndex) {
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
                    const routeBoxEl = getEl('routeBox');
                    routeBoxEl.style.display = (routeBoxEl.style.display === 'none') ? 'block' : 'none';
                }

                const originWaypoint = appState.waypoints[routeIndex * 2];
                const destinationWaypoint = appState.waypoints[routeIndex * 2 + 1];
                const groupLatLng = [originWaypoint, destinationWaypoint].filter(Boolean)
                    .map(airport => L.latLng(airport.latitude, airport.longitude));
                const bounds = L.latLngBounds(groupLatLng);

                if (groupLatLng.length > 1) {
                    map.fitBounds(bounds, { padding: [50, 50] });
                } else if (groupLatLng.length === 1) {
                    map.setView(groupLatLng[0], 4);
                }
            };

            if (appState.selectedRoutes.hasOwnProperty(routeIndex)) {
                button.classList.add('selected-route-button');
            } else {
                button.classList.remove('selected-route-button');
            }

            uiHandling.attachDateTooltip(button, routeIndex);

            const routeId = `${origin}-${destination}`;
            button.addEventListener('mouseover', () => {
                this.highlightButtonLines(routeId, 'white');
            });
            button.addEventListener('mouseout', () => {
                this.restoreButtonLines(routeId);
            });
        });

        if (appState.waypoints.length === 0 || appState.waypoints.length % 2 === 0) {
            this.addPlusButton();
        }
    },

    highlightButtonLines(routeId, color) {
        const lineSets = pathDrawing.routePathCache[routeId] || pathDrawing.dashedRoutePathCache[routeId] || [];
        lineSets.forEach(lineSet => {
            if (lineSet && lineSet.lines) {
                lineSet.lines.forEach(linePair => {
                    if (linePair.visibleLine) {
                        linePair.visibleLine.setStyle({ color: color });
                    }
                });
            } else if (lineSet && lineSet.visibleLine) {
                lineSet.visibleLine.setStyle({ color: color });
            }
        });
    },

    restoreButtonLines(routeId) {
        const lineSets = pathDrawing.routePathCache[routeId] || [];
        const dashedLineSets = pathDrawing.dashedRoutePathCache[routeId] || [];

        dashedLineSets.forEach(line => {
            if (line && line.visibleLine) {
                line.visibleLine.setStyle({ color: '#999' });
            }
        });
        lineSets.forEach(line => {
            if (line && line.visibleLine) {
                const color = line.visibleLine.options.originalColor || 'grey';
                line.visibleLine.setStyle({ color: color });
            }
        });
    },

    updateTripTable(selectedRoutesArray) {
        const infoPaneContent = getEl('infoPaneContent');
        infoPaneContent.innerHTML = '';

        const table = document.createElement('table');
        table.className = 'route-info-table';

        const thead = document.createElement('thead');
        thead.innerHTML = `
            <tr>
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
        const groupData = {};

        selectedRoutesArray.forEach((item, index) => {
            const group = item.group;
            if (!groupData[group]) {
                groupData[group] = {
                    departure: appState.routeDates[item.routeNumber]?.depart,
                    arrival: appState.routeDates[item.routeNumber]?.return,
                    price: item.displayData.price,
                    airlines: [item.displayData.airline],
                    stops: new Set(),
                    route: [item.displayData.route.split(' > ')[0]],
                    deep_link: item.displayData.deep_link
                };
            } else {
                groupData[group].arrival = appState.routeDates[item.routeNumber]?.return;
                groupData[group].airlines.push(item.displayData.airline);
            }
            groupData[group].route.push(item.displayData.route.split(' > ')[1]);
            if (index > 0) {
                groupData[group].stops.add(item.displayData.route.split(' > ')[0]);
            }
        });

        Object.values(groupData).forEach(data => {
            const depDate = new Date(data.departure);
            const arrDate = new Date(data.arrival);
            const depDayName = depDate.toLocaleDateString('en-US', { weekday: 'short' });
            const arrDayName = arrDate.toLocaleDateString('en-US', { weekday: 'short' });
            const formattedDeparture = `${depDayName} ${depDate.toLocaleDateString('en-US')}`;
            const formattedArrival = `${arrDayName} ${arrDate.toLocaleDateString('en-US')}`;
            const price = this.formatPrice(data.price);

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${formattedDeparture}</td>
                <td>${formattedArrival}</td>
                <td>${price}</td>
                <td>${data.airlines.join(', ')}</td>
                <td>${data.stops.size}</td>
                <td>${data.route.join(' > ')}</td>
                <td><a href="${data.deep_link}" target="_blank"><button>Book Flight</button></a></td>`;

            row.addEventListener('mouseover', () => {
                const routeString = data.route.join(' > ');
                const iataCodes = routeString.split(' > ');
                infoPane.highlightRoute(iataCodes, data.group);
            });
            row.addEventListener('mouseout', () => {
                lineManager.clearLinesByTags(['status:highlighted']);
            });

            tbody.appendChild(row);
        });

        table.appendChild(tbody);
        infoPaneContent.appendChild(table);

        let totalPrice = 0;
        const processedGroups = new Set();
        selectedRoutesArray.forEach(item => {
            if (!processedGroups.has(item.group)) {
                processedGroups.add(item.group);
                let priceVal = 0;
                if (typeof item.displayData.price === 'number') {
                    priceVal = item.displayData.price;
                } else if (typeof item.displayData.price === 'string') {
                    priceVal = parseFloat(item.displayData.price.replace(/[^\d.-]/g, ''));
                }
                if (!isNaN(priceVal)) {
                    totalPrice += priceVal;
                }
            }
        });

        const tripButton = getEl('tripButton');
        tripButton.textContent = totalPrice > 0 ? `$${totalPrice.toFixed(2)}` : '$0.00';
        tripButton.classList.add('green-button');

        if (tripButton && appState.selectedRoutes.length > 0) {
            tripButton.addEventListener('mouseover', () => {
                const allIataCodes = [];
                const tableRows = document.querySelectorAll('.route-info-table tbody tr');
                tableRows.forEach(row => {
                    const routeString = row.cells[5].textContent.trim();
                    allIataCodes.push(...routeString.split(' > '));
                });
                infoPane.highlightRoute(allIataCodes);
            });
            tripButton.addEventListener('mouseout', () => {
                lineManager.clearLinesByTags(['status:highlighted']);
            });
        }
    },

    formatPrice(price) {
        if (typeof price === 'number') {
            return price.toFixed(2);
        }
        if (typeof price === 'string') {
            const numeric = parseFloat(price.replace(/[^\d.-]/g, ''));
            return isNaN(numeric) ? '0.00' : numeric.toFixed(2);
        }
        return '0.00';
    },

    highlightRoute(iataCodes, group) {
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
        const menuBar = getEl('menu-bar');
        const plusButtonId = 'plus-button';
        if (!getEl(plusButtonId)) {
            const plusButton = document.createElement('button');
            plusButton.id = plusButtonId;
            plusButton.className = 'plus-button';
            plusButton.onclick = (event) => {
                if (appState.waypoints.length > 0) {
                    const lastWaypoint = appState.waypoints[appState.waypoints.length - 1];
                    const newWaypoint = { ...lastWaypoint };
                    updateState('addWaypoint', newWaypoint, 'infoPane.addPlusButton');

                    const lastRoute = appState.routes.length - 1;
                    const lastDepartDate = appState.routeDates[lastRoute]?.depart;
                    const lastReturnDate = appState.routeDates[lastRoute]?.return;
                    let newDepartDate = lastReturnDate || lastDepartDate || new Date();
                    newDepartDate = new Date(newDepartDate);
                    newDepartDate.setDate(newDepartDate.getDate() + 1);
                    updateState(
                        'updateRouteDate',
                        { routeNumber: appState.routes.length, depart: newDepartDate.toISOString().slice(0, 10) },
                        'infoPane.addPlusButton'
                    );
                }
                routeBox.showRouteBox(event, appState.routes.length);
            };
            plusButton.innerHTML = `
                <svg height="32px" width="32px" viewBox="0 0 64 64" fill="#aaa">
                    <rect x="30" y="10" width="4" height="44"></rect>
                    <rect x="10" y="30" width="44" height="4"></rect>
                </svg>`;
            menuBar.appendChild(plusButton);
        }
    }
};

export { infoPane };
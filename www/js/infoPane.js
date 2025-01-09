import { appState, updateState } from './stateManager.js';
import { pathDrawing } from './pathDrawing.js';
import { buildRouteTable } from './routeTable/routeTable.js';
import { selectedRoute } from './routeTable/selectedRoute.js';
import { adjustMapSize, map } from './map.js';
import { uiHandling } from './uiHandling.js';
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
                map.fitBounds(L.latLngBounds(waypointsLatLng), { padding: [50, 50] });
            }
        });
        this.addPlusButton();
    },

    handleStateChange(event) {
        if (['updateSelectedRoute', 'removeSelectedRoute', 'changeView', 'updateRoutes'].includes(event.detail.key)) {
            this.displayContent();
        }
        this.updateRouteButtons();
    },

    displayContent() {
        const infoPaneContent = getEl('infoPaneContent');
        infoPaneContent.innerHTML = '';
        const { currentView, currentRouteIndex, selectedRoutes } = appState;

        switch (currentView) {
            case 'trip':
                this.updateTripTable(Object.values(selectedRoutes));
                break;
            case 'routeTable':
                buildRouteTable(currentRouteIndex);
                break;
            case 'selectedRoute':
                if (selectedRoutes[currentRouteIndex]) {
                    selectedRoute.displaySelectedRouteInfo(currentRouteIndex);
                } else {
                    appState.currentView = 'trip';
                    this.displayContent();
                }
                break;
        }
    },

    updateRouteButtons() {
        const menuBar = getEl('menu-bar');
        menuBar.innerHTML = '';

        appState.waypoints.forEach((waypoint, index) => {
            const routeIndex = Math.floor(index / 2);
            const buttonId = `route-button-${routeIndex}`;
            let button = getEl(buttonId);

            const origin = appState.waypoints[routeIndex * 2]?.iata_code || 'Any';
            const destination = appState.waypoints[routeIndex * 2 + 1]?.iata_code || 'Any';
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
                    appState.currentView = appState.selectedRoutes.hasOwnProperty(routeIndex) ? 'selectedRoute' : 'routeBox';
                    if (appState.currentView === 'routeBox') {
                        routeBox.showRouteBox(event, routeIndex);
                    }
                    this.displayContent();
                } else {
                    const routeBoxEl = getEl('routeBox');
                    routeBoxEl.style.display = (routeBoxEl.style.display === 'none') ? 'block' : 'none';
                }

                const groupLatLng = [appState.waypoints[routeIndex * 2], appState.waypoints[routeIndex * 2 + 1]].filter(Boolean)
                    .map(airport => L.latLng(airport.latitude, airport.longitude));
                const bounds = L.latLngBounds(groupLatLng);

                if (groupLatLng.length > 1) {
                    map.fitBounds(bounds, { padding: [50, 50] });
                } else if (groupLatLng.length === 1) {
                    map.setView(groupLatLng[0], 4);
                }
            };

            button.classList.toggle('selected-route-button', appState.selectedRoutes.hasOwnProperty(routeIndex));
            uiHandling.attachDateTooltip(button, routeIndex);

            const routeId = `${origin}-${destination}`;
            button.addEventListener('mouseover', () => this.highlightButtonLines(routeId, 'white'));
            button.addEventListener('mouseout', () => this.restoreButtonLines(routeId));
        });

        if (appState.waypoints.length === 0 || appState.waypoints.length % 2 === 0) {
            this.addPlusButton();
        }
    },

    highlightButtonLines(routeId, color) {
        const lineSets = [...(pathDrawing.routePathCache[routeId] || []), ...(pathDrawing.dashedRoutePathCache[routeId] || [])];
        lineSets.forEach(lineSet => {
            if (lineSet?.lines) {
                lineSet.lines.forEach(linePair => linePair.visibleLine?.setStyle({ color }));
            } else {
                lineSet?.visibleLine?.setStyle({ color });
            }
        });
    },

    restoreButtonLines(routeId) {
        const lineSets = [...(pathDrawing.routePathCache[routeId] || []), ...(pathDrawing.dashedRoutePathCache[routeId] || [])];
        lineSets.forEach(line => {
            const color = line.visibleLine?.options.originalColor || 'grey';
            line.visibleLine?.setStyle({ color });
        });
    },

    updateTripTable(selectedRoutesArray) {
        const infoPaneContent = getEl('infoPaneContent');
        infoPaneContent.innerHTML = '';

        const table = document.createElement('table');
        table.className = 'route-info-table';
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Departure</th>
                    <th>Arrival</th>
                    <th>Price</th>
                    <th>Airline</th>
                    <th>Stops</th>
                    <th>Route</th>
                    <th>Action</th>
                </tr>
            </thead>
            <tbody></tbody>`;
        const tbody = table.querySelector('tbody');

        const groupData = selectedRoutesArray.reduce((acc, item, index) => {
            const group = item.group;
            if (!acc[group]) {
                acc[group] = {
                    departure: appState.routeDates[item.routeNumber]?.depart,
                    arrival: appState.routeDates[item.routeNumber]?.return,
                    price: item.displayData.price,
                    airlines: [item.displayData.airline],
                    stops: new Set(),
                    route: [item.displayData.route.split(' > ')[0]],
                    deep_link: item.displayData.deep_link
                };
            } else {
                acc[group].arrival = appState.routeDates[item.routeNumber]?.return;
                acc[group].airlines.push(item.displayData.airline);
            }
            acc[group].route.push(item.displayData.route.split(' > ')[1]);
            if (index > 0) {
                acc[group].stops.add(item.displayData.route.split(' > ')[0]);
            }
            return acc;
        }, {});

        Object.values(groupData).forEach(data => {
            const depDate = new Date(data.departure);
            const arrDate = new Date(data.arrival);
            const formattedDeparture = `${depDate.toLocaleDateString('en-US', { weekday: 'short' })} ${depDate.toLocaleDateString('en-US')}`;
            const formattedArrival = `${arrDate.toLocaleDateString('en-US', { weekday: 'short' })} ${arrDate.toLocaleDateString('en-US')}`;
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

            row.addEventListener('mouseover', () => this.highlightRoute(data.route, data.group));
            row.addEventListener('mouseout', () => lineManager.clearLinesByTags(['status:highlighted']));

            tbody.appendChild(row);
        });

        infoPaneContent.appendChild(table);

        // Modify the total price calculation to only count once per group
        const seenGroups = new Set();
        const totalPrice = selectedRoutesArray.reduce((total, item) => {
            if (!seenGroups.has(item.group)) {
                seenGroups.add(item.group);
                const priceVal = parseFloat(String(item.displayData.price).replace(/[^\d.-]/g, '')) || 0;
                return total + priceVal;
            }
            return total;
        }, 0);

        const tripButton = getEl('tripButton');
        tripButton.textContent = `$${totalPrice.toFixed(2)}`;
        tripButton.classList.add('green-button');

        if (tripButton && appState.selectedRoutes.length > 0) {
            tripButton.addEventListener('mouseover', () => {
                const allIataCodes = Array.from(document.querySelectorAll('.route-info-table tbody tr'))
                    .flatMap(row => row.cells[5].textContent.trim().split(' > '));
                this.highlightRoute(allIataCodes);
            });
            tripButton.addEventListener('mouseout', () => lineManager.clearLinesByTags(['status:highlighted']));
        }
    },

    formatPrice(price) {
        const numeric = parseFloat(String(price).replace(/[^\d.-]/g, '')) || 0;
        return numeric.toFixed(2);
    },

    highlightRoute(iataCodes, group) {
        iataCodes.forEach((code, index) => {
            if (index < iataCodes.length - 1) {
                const routeId = `${iataCodes[index]}-${iataCodes[index + 1]}`;
                const filterTags = ['status:highlighted', `route:${routeId}`, group && `group:${group}`].filter(Boolean);
                lineManager.getLinesByTags(filterTags, 'route').forEach(line => {
                    line.addTag('status:highlighted');
                    line.visibleLine.setStyle({ color: 'white' });
                });
            }
        });
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
                    let newDepartDate = new Date(lastReturnDate || lastDepartDate || new Date());
                    newDepartDate.setDate(newDepartDate.getDate() + 1);
                    updateState('updateRouteDate', { routeNumber: appState.routes.length, depart: newDepartDate.toISOString().slice(0, 10) }, 'infoPane.addPlusButton');
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
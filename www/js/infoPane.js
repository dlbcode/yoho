import { appState, updateState } from './stateManager.js';
import { pathDrawing } from './pathDrawing.js';
import { buildRouteTable } from './routeTable/routeTable.js';
import { selectedRoute } from './routeTable/selectedRoute.js';
import { adjustMapSize, map } from './map.js';
import { uiHandling } from './uiHandling.js';
import { routeBox } from './routeBox/routeBox.js';
import { lineManager } from './lineManager.js';

const infoPane = {
    init() {
        document.addEventListener('stateChange', this.handleStateChange.bind(this));
        document.getElementById('tripButton').addEventListener('click', this.handleTripButtonClick.bind(this));
        this.addPlusButton();
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
        const infoPaneContent = document.getElementById('infoPaneContent');
        infoPaneContent.innerHTML = '';
        const { currentView, currentRouteIndex, selectedRoutes } = appState;

        if (currentView === 'trip') {
            this.updateTripTable(Object.values(selectedRoutes));
        } else if (currentView === 'routeTable') {
            buildRouteTable(currentRouteIndex);
        } else if (currentView === 'selectedRoute' && selectedRoutes[currentRouteIndex] !== undefined) {
            selectedRoute.displaySelectedRouteInfo(currentRouteIndex);
        } else {
            appState.currentView = 'trip';
            this.displayContent();
        }
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
            const buttonText = `${origin}-${destination}`;

            if (!button.id) {
                button.id = buttonId;
                button.className = 'route-info-button';
                menuBar.appendChild(button);
            }

            button.textContent = buttonText;
            button.onclick = this.handleRouteButtonClick.bind(this, routeIndex);

            const [originWaypoint, destinationWaypoint] = [appState.waypoints[routeIndex * 2], appState.waypoints[routeIndex * 2 + 1]];
            const group = [originWaypoint, destinationWaypoint].filter(wp => wp).map(airport => L.latLng(airport.latitude, airport.longitude));
            if (group.length > 1) {
                map.fitBounds(L.latLngBounds(group), { padding: [50, 50] });
            } else if (group.length === 1) {
                map.setView(group[0], 4);
            }

            button.classList.toggle('selected-route-button', appState.selectedRoutes.hasOwnProperty(routeIndex));
            uiHandling.attachDateTooltip(button, routeIndex);
            button.addEventListener('mouseover', () => this.highlightRouteLines(origin, destination, 'white'));
            button.addEventListener('mouseout', () => this.resetRouteLineColors(origin, destination));
        });

        if (appState.waypoints.length === 0 || appState.waypoints.length % 2 === 0) {
            this.addPlusButton();
        }
    },

    handleRouteButtonClick(routeIndex, event) {
        adjustMapSize();
        if (appState.currentRouteIndex !== routeIndex) {
            appState.currentRouteIndex = routeIndex;
            appState.currentView = appState.selectedRoutes.hasOwnProperty(routeIndex) ? 'selectedRoute' : 'routeTable';
            if (appState.currentView === 'routeTable') {
                routeBox.showRouteBox(event, routeIndex);
            }
            this.displayContent();
        } else {
            const routeBoxElement = document.getElementById('routeBox');
            if (routeBoxElement.style.display === 'none') {
                routeBox.showRouteBox(event, routeIndex);
            } else {
                routeBoxElement.style.display = 'none';
            }
        }
    },

    highlightRouteLines(origin, destination, color) {
        const routeId = `${origin}-${destination}`;
        const lineSets = pathDrawing.routePathCache[routeId] || pathDrawing.dashedRoutePathCache[routeId] || [];
        lineSets.forEach(lineSet => {
            lineSet.lines?.forEach(linePair => linePair.visibleLine?.setStyle({ color }));
        });
    },

    resetRouteLineColors(origin, destination) {
        const routeId = `${origin}-${destination}`;
        const lineSets = pathDrawing.routePathCache[routeId] || [];
        const dashedLineSets = pathDrawing.dashedRoutePathCache[routeId] || [];

        dashedLineSets.forEach(line => line.visibleLine?.setStyle({ color: '#999' }));
        lineSets.forEach(line => {
            const originalColor = line.visibleLine?.options.originalColor || 'grey';
            line.visibleLine?.setStyle({ color: originalColor });
        });
    },

    updateTripTable(selectedRoutesArray) {
        const infoPaneContent = document.getElementById('infoPaneContent');
        infoPaneContent.innerHTML = '';

        const table = document.createElement('table');
        table.className = 'route-info-table';
        table.innerHTML = `<thead><tr><th>Departure</th><th>Arrival</th><th>Price</th><th>Airline</th><th>Stops</th><th>Route</th><th>Action</th></tr></thead>`;

        const tbody = document.createElement('tbody');
        let groupData = this.aggregateGroupData(selectedRoutesArray);

        Object.values(groupData).forEach(data => {
            const { formattedDeparture, formattedArrival, price, deep_link, route, group } = this.formatRowData(data);
            const row = document.createElement('tr');
            row.innerHTML = `<td>${formattedDeparture}</td><td>${formattedArrival}</td><td>${price}</td><td>${data.airlines.join(', ')}</td><td>${data.stops.size}</td><td>${route.join(' > ')}</td><td><a href="${deep_link}" target="_blank"><button>Book Flight</button></a></td>`;
            row.addEventListener('mouseover', () => this.highlightRoute(data.route, group));
            row.addEventListener('mouseout', () => lineManager.clearLinesByTags(['status:highlighted']));
            tbody.appendChild(row);
        });

        table.appendChild(tbody);
        infoPaneContent.appendChild(table);
        this.updateTripButton(selectedRoutesArray);
    },

    aggregateGroupData(selectedRoutesArray) {
        return selectedRoutesArray.reduce((groupData, item, index) => {
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
        let totalPrice = selectedRoutesArray.reduce((total, item) => {
            let price = typeof item.displayData.price === 'number' ? item.displayData.price : parseFloat(item.displayData.price.replace(/[^\d.-]/g, ''));
            return isNaN(price) ? total : total + price;
        }, 0);

        const tripButton = document.getElementById('tripButton');
        tripButton.textContent = totalPrice > 0 ? `$${totalPrice.toFixed(2)}` : '$0.00';
        tripButton.classList.add('green-button');

        if (appState.selectedRoutes.length > 0) {
            tripButton.addEventListener('mouseover', () => {
                const tableRows = document.querySelectorAll('.route-info-table tbody tr');
                const allIataCodes = Array.from(tableRows).flatMap(row => row.cells[5].textContent.trim().split(' > '));
                this.highlightRoute(allIataCodes);
            });
            tripButton.addEventListener('mouseout', () => lineManager.clearLinesByTags(['status:highlighted']));
        }
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
            plusButton.innerHTML = `<svg height="32px" width="32px" viewBox="0 0 64 64" fill="#aaa"><rect x="30" y="10" width="4" height="44"></rect><rect x="10" y="30" width="44" height="4"></rect></svg>`;
            plusButton.onclick = this.handlePlusButtonClick.bind(this);
            menuBar.appendChild(plusButton);
        }
    },

    handlePlusButtonClick(event) {
        if (appState.waypoints.length > 0) {
            const lastWaypoint = { ...appState.waypoints[appState.waypoints.length - 1] };
            updateState('addWaypoint', lastWaypoint, 'infoPane.addPlusButton');
            const lastRouteIndex = appState.routes.length - 1;
            const newDepartDate = new Date((appState.routeDates[lastRouteIndex]?.return || appState.routeDates[lastRouteIndex]?.depart) ?? Date.now());
            newDepartDate.setDate(newDepartDate.getDate() + 1);
            updateState('updateRouteDate', { routeNumber: lastRouteIndex + 1, depart: newDepartDate.toISOString().slice(0, 10) }, 'infoPane.addPlusButton');
        }
        routeBox.showRouteBox(event, appState.routes.length);
    }
};

export { infoPane };
import { appState, updateState } from './stateManager.js';
import { pathDrawing } from './pathDrawing.js';
import { buildRouteTable } from './routeTable/routeTable.js';
import { selectedRoute } from './routeTable/selectedRoute.js';
import { map } from './map.js';
import { uiHandling } from './uiHandling.js';


const infoPane = {
  init() {
    const infoPaneContent = document.getElementById('infoPaneContent');
    const tripButton = document.getElementById('tripButton');
    document.addEventListener('stateChange', this.handleStateChange.bind(this));

    tripButton.addEventListener('click', () => {
      appState.currentView = 'trip';
      this.displayContent();
  
      // Extract latitude and longitude from each waypoint
      const waypointsLatLng = appState.waypoints.map(waypoint => [waypoint.latitude, waypoint.longitude]);
  
      // Check if there are waypoints to adjust the map view
      if (waypointsLatLng.length > 0) {
          const bounds = L.latLngBounds(waypointsLatLng);
          map.fitBounds(bounds, { padding: [50, 50] }); // Adjust padding as needed
      }
    });  
  },

  handleStateChange(event) {
    this.updateRouteButtons();
    if (event.detail.key === 'updateSelectedRoute' || event.detail.key === 'removeSelectedRoute' || event.detail.key === 'changeView' || event.detail.key === 'updateRoutes' || event.detail.key === 'updateRoutes') {
      //appState.currentView = 'trip';
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
        }

        button.textContent = buttonText;

        button.onclick = () => {
          pathDrawing.clearLines();
          pathDrawing.drawLines();
            appState.currentRouteIndex = routeIndex;
            if (appState.selectedRoutes.hasOwnProperty(routeIndex)) {
                appState.currentView = 'selectedRoute';
            } else {
                appState.currentView = 'routeTable';
            }
            this.displayContent();

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

        // Attach the checkmark to indicate selection status
        let checkmark = button.querySelector('.route-checkmark');
        if (!checkmark) {
            checkmark = document.createElement('span');
            checkmark.classList.add('route-checkmark');
            button.appendChild(checkmark);
        }

        if (appState.selectedRoutes.hasOwnProperty(routeIndex)) {
            checkmark.classList.add('selected');
            checkmark.classList.remove('unselected');
            checkmark.innerHTML = '✓';
        } else {
            checkmark.classList.add('unselected');
            checkmark.classList.remove('selected');
            checkmark.innerHTML = ''; // Or any indicator for unselected
        }

        uiHandling.attachDateTooltip(button, routeIndex);

        button.addEventListener('mouseover', () => {
          const routeId = `${origin}-${destination}`;
          const pathLines = pathDrawing.routePathCache[routeId] || pathDrawing.dashedRoutePathCache[routeId] || [];
          pathLines.forEach(path => path.setStyle({ color: 'white' }));
      });
      
      button.addEventListener('mouseout', () => {
        const routeId = `${origin}-${destination}`;
        let pathLines = pathDrawing.routePathCache[routeId] || [];
        let dashedPathLines = pathDrawing.dashedRoutePathCache[routeId] || [];

        dashedPathLines.forEach(path => {
            path.setStyle({ color: '#999' });
        });

        pathLines.forEach(path => {
            if (path.originalColor) {
                path.setStyle({ color: path.originalColor });
            } else {
                path.setStyle({ color: 'grey' });
            }
        });
    });            
    });
  },

  updateTripTable: function(selectedRoutesArray) {
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
                departure: item.displayData.departure, // First route's departure
                arrival: item.displayData.arrival, // Last route's arrival (will be updated)
                price: item.displayData.price,
                airlines: [item.displayData.airline],
                stops: new Set(), // Use a Set to ensure unique stops
                route: [item.displayData.route.split(' > ')[0]], // Initialize with origin
                deep_link: item.displayData.deep_link
            };
        } else {
            groupData[group].arrival = item.displayData.arrival; // Update to last route's arrival
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
            let price = parseFloat(item.displayData.price.replace(/[^\d.-]/g, ''));
            price = isNaN(price) ? 0 : price; // Use 0 if the price is not a valid number
            totalPrice += price; // Add price to total
        }
    });

    console.log('Total Price:', totalPrice);
    
    const tripButton = document.getElementById('tripButton');
    tripButton.textContent = totalPrice > 0 ? `$${totalPrice.toFixed(2)}` : '$0.00'; // Update button text with total price or $0.00
    tripButton.classList.add('green-button'); // Apply green styling class
},

formatPrice: function(price) {
  const numericPrice = parseFloat(price.replace(/[^\d.-]/g, ''));
  return isNaN(numericPrice) ? "0.00" : numericPrice.toFixed(2);
}

}

export { infoPane };

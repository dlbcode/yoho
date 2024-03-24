import { appState, updateState } from './stateManager.js';
import { pathDrawing } from './pathDrawing.js';
import { buildRouteTable } from './routeTable/routeTable.js';
import { selectedRoute } from './routeTable/selectedRoute.js';
import { map } from './map.js';


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
    menuBar.innerHTML = '';

    appState.routes.forEach((route, index) => {
        let button = document.createElement('button');
        if (appState.roundTrip && index === 0) {
            button.textContent = `${route.originAirport.iata_code}-${route.destinationAirport.iata_code} - ${route.originAirport.iata_code}-${route.destinationAirport.iata_code}`;
        } else if (!appState.roundTrip) {
            button.textContent = `${route.originAirport.iata_code}-${route.destinationAirport.iata_code}`;
        }
        if (!appState.roundTrip || (appState.roundTrip && index === 0)) {
            button.className = 'route-info-button';
            button.onclick = () => {
              // Check if the route has a selectedRoutes entry
              if (appState.selectedRoutes.hasOwnProperty(index)) {
                  appState.currentView = 'selectedRoute';
                  appState.currentRouteIndex = index;
                  this.displayContent();
              }
              appState.currentView = 'routeTable';
              appState.currentRouteIndex = index;
              this.displayContent();
              // Logic to pan and zoom the map for routes without a selectedRoute entry
              const origin = route.originAirport;
              const destination = route.destinationAirport;
              const group = [origin, destination].map(airport => L.latLng(airport.latitude, airport.longitude));
              const bounds = L.latLngBounds(group);
              map.fitBounds(bounds, { padding: [50, 50] }); // Adjust padding as needed
          };          
            menuBar.appendChild(button);
        };

      // Create the checkmark span and add the base class
      const checkmark = document.createElement('span');
      checkmark.innerHTML = '✓'; // Checkmark icon
      checkmark.classList.add('route-checkmark');

      // Conditionally add the selected or unselected class
      if (appState.selectedRoutes.hasOwnProperty(index)) {
        checkmark.classList.add('selected'); // Green checkmark for selected routes
      } else {
        checkmark.classList.add('unselected'); // Grey checkmark for unselected routes
      }

      button.appendChild(checkmark);

      button.addEventListener('mouseover', () => {
        const routeId = `${route.originAirport.iata_code}-${route.destinationAirport.iata_code}`;
        const pathLines = pathDrawing.routePathCache[routeId] || pathDrawing.dashedRoutePathCache[routeId] || [];
        pathLines.forEach(path => path.setStyle({ color: 'white' }));
      });
      
      button.addEventListener('mouseout', () => {
          const routeId = `${route.originAirport.iata_code}-${route.destinationAirport.iata_code}`;
          const pathLines = pathDrawing.routePathCache[routeId] || pathDrawing.dashedRoutePathCache[routeId] || [];
          pathLines.forEach(path => {
              const originalColor = pathDrawing.getColorBasedOnPrice(route.price);
              path.setStyle({ color: originalColor });
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

        const formattedDeparture = `${departureDayName} ${departureDate.toLocaleDateString('en-US')}`;
        const formattedArrival = `${arrivalDayName} ${arrivalDate.toLocaleDateString('en-US')}`;

        const row = document.createElement('tr');
        row.innerHTML = `<td>${formattedDeparture}</td>
            <td>${formattedArrival}</td>
            <td>${data.price}</td>
            <td>${data.airlines.join(', ')}</td>
            <td>${data.stops.size}</td>
            <td>${data.route.join(' > ')}</td>
            <td><a href="${data.deep_link}" target="_blank"><button>Book Flight</button></a></td>`;

        tbody.appendChild(row);
    });

    table.appendChild(tbody);
    infoPaneContent.appendChild(table);
}


}

export { infoPane };

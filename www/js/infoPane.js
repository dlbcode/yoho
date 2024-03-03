import { appState, updateState } from './stateManager.js';
import { pathDrawing } from './pathDrawing.js';
import { buildRouteTable } from './routeTable/routeTable.js';
import { selectedRoute } from './routeTable/selectedRoute.js';
import { flightMap } from './flightMap.js';

const infoPane = {
  init() {
    const infoPaneContent = document.getElementById('infoPaneContent');
    const tripButton = document.getElementById('tripButton');
    document.addEventListener('stateChange', this.handleStateChange.bind(this));

    tripButton.addEventListener('click', () => {
      appState.currentView = 'trip';
      this.displayContent();
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
    
    if (appState.currentView === 'trip') {
      const selectedRoutesArray = Object.values(appState.selectedRoutes);
      this.updateTripTable(selectedRoutesArray);
    } else if (appState.currentView === 'routeTable') {
      const routeIndex = appState.currentRouteIndex;
      buildRouteTable(routeIndex);
    } else if (appState.currentView === 'selectedRoute') {
      const routeIndex = appState.currentRouteIndex;
      selectedRoute.displaySelectedRouteInfo(routeIndex);
    }
  },

  updateRouteButtons() {
    const menuBar = document.getElementById('menu-bar');
    menuBar.innerHTML = '';

    // New logic to determine if it's a round trip and adjust button text
    let isRoundTrip = false;
    if (appState.waypoints.length >= 4) {
        const firstWaypoint = appState.waypoints[0].iata_code;
        const secondWaypoint = appState.waypoints[1].iata_code;
        const thirdWaypoint = appState.waypoints[2].iata_code;
        const fourthWaypoint = appState.waypoints[3].iata_code;

        isRoundTrip = firstWaypoint === fourthWaypoint && secondWaypoint === thirdWaypoint;
    }

    appState.roundTrip = isRoundTrip;

    appState.routes.forEach((route, index) => {
        let button = document.createElement('button');
        if (isRoundTrip && index === 0) {
            button.textContent = `${route.originAirport.iata_code}-${route.destinationAirport.iata_code} - ${route.originAirport.iata_code}-${route.destinationAirport.iata_code}`;
        } else if (!isRoundTrip) {
            button.textContent = `${route.originAirport.iata_code}-${route.destinationAirport.iata_code}`;
        }
        if (!isRoundTrip || (isRoundTrip && index === 0)) {
            button.className = 'route-info-button';
            button.onclick = () => {
                if (appState.selectedRoutes.hasOwnProperty(index)) {
                    appState.currentView = 'selectedRoute';
                    appState.currentRouteIndex = index;
                    this.displayContent();
                } else {
                    appState.currentView = 'routeTable';
                    appState.currentRouteIndex = index;
                    this.displayContent();
                }
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

    // Track the first route of each group to include in the trip table
    let includedGroups = {};

    selectedRoutesArray.forEach(item => {
        // Check if the group of this item has already been included
        if (!includedGroups[item.group]) {
            // Mark this group as included
            includedGroups[item.group] = true;

            const { displayData, fullData } = item; // Assuming fullData contains route information
            if (displayData && fullData) {
                const row = document.createElement('tr');
                row.innerHTML = `<td>${displayData.departure}</td>
                    <td>${displayData.arrival}</td>
                    <td>${displayData.price}</td>
                    <td>${displayData.airline}</td>
                    <td>${displayData.stops}</td>
                    <td>${displayData.route}</td>
                    <td><a href="${displayData.deep_link}" target="_blank"><button>Book Flight</button></a></td>`;

                  row.addEventListener('mouseover', function() {
                    const segments = displayData.route.split(', ');
                    segments.forEach(segment => {
                        const [originIata, destinationIata] = segment.split(' > ');
                        const routeId = `${originIata}-${destinationIata}`;
                        const pathLines = pathDrawing.routePathCache[routeId];
                        if (pathLines) {
                            pathLines.forEach(path => path.setStyle({ color: 'white' }));
                        }
                    });
                  });                                   
            
                row.addEventListener('mouseout', function() {
                    pathDrawing.clearLines();
                    pathDrawing.drawLines();
                });

                tbody.appendChild(row);
            }
        }
    });

    table.appendChild(tbody);
    infoPaneContent.appendChild(table);
  }
}

export { infoPane };

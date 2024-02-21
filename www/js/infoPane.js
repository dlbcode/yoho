import { appState, updateState } from './stateManager.js';
import { pathDrawing } from './pathDrawing.js';
import { buildRouteTable } from './routeTable/routeTable.js';

const infoPane = {
  init() {
    const infoPaneContent = document.getElementById('infoPaneContent');
    const mapButton = document.getElementById('mapButton');
    document.addEventListener('stateChange', this.handleStateChange.bind(this));
  },

  handleStateChange(event) {
    this.updateRouteButtons();
  },

  updateRouteButtons() {
    const menuBar = document.getElementById('menu-bar');
    menuBar.innerHTML = '';

    appState.routes.forEach((route, index) => {
      let button = document.createElement('button');
      button.textContent = `${route.originAirport.iata_code}-${route.destinationAirport.iata_code}`;
      button.className = 'route-info-button';
      button.onclick = () => buildRouteTable(index);
      menuBar.appendChild(button);

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

  updateTripTable: function(routeData) {
    const infoPaneContent = document.getElementById('infoPaneContent');
    infoPaneContent.innerHTML = ''; // Clear existing content

    const table = document.createElement('table');
    table.className = 'route-info-table';
    // Add more styling as needed

    const thead = document.createElement('thead');
    thead.innerHTML = `<tr>
        <th>Departure</th>
        <th>Arrival</th>
        <th>Price</th>
        <th>Airline</th>
        <th>Stops</th>
        <th>Route</th>
        <th>Action</th> <!-- New column for the action button -->
    </tr>`;
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    const row = document.createElement('tr');
    row.innerHTML = `<td>${routeData.departure}</td>
        <td>${routeData.arrival}</td>
        <td>${routeData.price}</td>
        <td>${routeData.airline}</td>
        <td>${routeData.stops}</td>
        <td>${routeData.route}</td>
        <td><a href="${routeData.deep_link}" target="_blank"><button>Book Flight</button></a></td>`; // Adding the Book Flight button
    tbody.appendChild(row);

    table.appendChild(tbody);
    infoPaneContent.appendChild(table);
  }
}

export { infoPane };
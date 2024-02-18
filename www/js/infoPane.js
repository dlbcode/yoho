import { appState, updateState } from './stateManager.js';
import { pathDrawing } from './pathDrawing.js';
import { findCheapestRoutes } from './findCheapestRoutes.js';
import { buildRouteTable } from './routeTable/routeTable.js';

const infoPane = {
  init() {
    const infoPaneContent = document.getElementById('infoPaneContent');
    const mapButton = document.getElementById('mapButton');
    mapButton.addEventListener('click', this.displayAllRoutesSummary.bind(this));
    document.addEventListener('stateChange', this.handleStateChange.bind(this));
  },

  displayAllRoutesSummary() {
    this.updateRouteInfoPane(appState.routes);
  },

  handleStateChange(event) {
    this.updateRouteButtons();
    this.updateRouteInfoPane(appState.routes);
    findCheapestRoutes.findCheapestRouteAndAddWaypoints();
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

  updateRouteInfoPane: function(routes) {
    const infoPaneContent = document.getElementById('infoPaneContent');
    infoPaneContent.innerHTML = '';

    const table = document.createElement('table');
    table.className = 'sortable-table';
    table.style.width = '100%';
    table.setAttribute('border', '1');

    const thead = document.createElement('thead');
    let headerRow = `<tr>
                        <th>Origin</th>
                        <th>Destination</th>
                        <th>Price</th>
                        <th>Action</th>
                     </tr>`;
    thead.innerHTML = headerRow;
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    let totalPrice = 0; // Initialize total price
    routes.forEach(route => {
        let row = document.createElement('tr');
        let price = parseFloat(route.price); // Parse the price to a number
        totalPrice += price; // Add to total price
        let formattedPrice = `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        row.innerHTML = `<td>${route.originAirport.city} (${route.originAirport.iata_code})</td>
                           <td>${route.destinationAirport.city} (${route.destinationAirport.iata_code})</td>
                           <td>${formattedPrice}</td>
                           <td><button class='update-price-btn'>Update Price</button></td>`;
        tbody.appendChild(row);
    });

    // Create and append the total price row
    let totalRow = document.createElement('tr');
    let formattedTotalPrice = `$${totalPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    totalRow.innerHTML = `<td></td>
                           <td style="text-align: right; color: white;">Total Estimated Price:</td>
                           <td style="color: white;">${formattedTotalPrice}</td>
                           <td></td>`;
    tbody.appendChild(totalRow);

    table.appendChild(tbody);
    infoPaneContent.appendChild(table);
  },
}

export { infoPane };
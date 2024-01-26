import { appState } from './stateManager.js';
import { pathDrawing } from './pathDrawing.js';
import { findCheapestRoutes } from './findCheapestRoutes.js';

const infoPane = {

  init() {
    const infoPaneContent = document.getElementById('infoPaneContent');
    document.addEventListener('routesArrayUpdated', this.handleStateChange.bind(this));
},

 handleStateChange(event) {
     this.updateRouteButtons();
     this.updateRouteInfoPane(appState.routes);
     findCheapestRoutes.findCheapestRouteAndAddWaypoints();
 },

 updateRouteButtons: function() {
    const menuBar = document.getElementById('menu-bar');
    menuBar.innerHTML = ''; // Clear existing buttons

    appState.routes.forEach((route, index) => {
        let button = document.createElement('button');
        button.textContent = `${route.originAirport.iata_code}-${route.destinationAirport.iata_code}`;
        button.className = 'route-info-button';
        button.onclick = () => this.handleRouteInfoClick(index);

        // Add mouseover event listener
        button.addEventListener('mouseover', () => {
            const routeId = `${route.originAirport.iata_code}-${route.destinationAirport.iata_code}`;
            const pathLines = pathDrawing.routePathCache[routeId] || [];
            if (pathLines.length > 0) {
                pathLines.forEach(path => path.setStyle({ color: 'white' }));
            }
        });

        // Add mouseout event listener
        button.addEventListener('mouseout', () => {
            const routeId = `${route.originAirport.iata_code}-${route.destinationAirport.iata_code}`;
            const pathLines = pathDrawing.routePathCache[routeId] || [];
            if (pathLines.length > 0) {
                pathLines.forEach(path => path.setStyle({ color: pathDrawing.getColorBasedOnPrice(route.price) }));
            }
        });

        menuBar.appendChild(button);
    });
},

handleRouteInfoClick: function(routeIndex) {
    // Logic for handling route info button click
    console.log(`Route button clicked for route index: ${routeIndex}`);
},

 updateRouteInfoPane(routes) {
  const infoPaneContent = document.getElementById('infoPaneContent');
  infoPaneContent.innerHTML = '';

  const table = document.createElement('table');
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
  routes.forEach(route => {
      let row = document.createElement('tr');
      row.innerHTML = `<td>${route.originAirport.city} (${route.origin})</td>
                       <td>${route.destinationAirport.city} (${route.destination})</td>
                       <td>${route.price}</td>
                       <td><button class='update-price-btn'>Update Price</button></td>`;

        row.addEventListener('mouseover', () => {
            const routeId = `${route.origin}-${route.destination}`;
            const pathLines = pathDrawing.routePathCache[routeId] || pathDrawing.dashedRoutePathCache[routeId];
            if (pathLines && pathLines.length > 0) {
                row.dataset.originalColor = pathLines[0].options.color;
                pathLines.forEach(path => path.setStyle({ color: 'white' }));
            }
        });
        row.addEventListener('mouseout', () => {
            const routeId = `${route.origin}-${route.destination}`;
            const pathLines = pathDrawing.routePathCache[routeId] || pathDrawing.dashedRoutePathCache[routeId];
            if (pathLines && pathLines.length > 0) {
                const originalColor = row.dataset.originalColor;
                pathLines.forEach(path => path.setStyle({ color: originalColor }));
            }
            pathDrawing.clearLines();
            pathDrawing.drawLines();
        });

        // Add event listener for 'Update Price' button
        const updateButton = row.querySelector('.update-price-btn');
        updateButton.addEventListener('click', () => {
            // Logic to handle price update
            console.log(`Update price for route: ${route.origin}-${route.destination}`);
        });

        tbody.appendChild(row);
    });
    table.appendChild(tbody);

    infoPaneContent.appendChild(table);
},
};

export { infoPane };
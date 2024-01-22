import { appState } from './stateManager.js';
import { pathDrawing } from './pathDrawing.js';
import { findCheapestRoutes } from './findCheapestRoutes.js';

const infoPane = {

  init() {
    const infoPaneContent = document.getElementById('infoPaneContent');
    document.addEventListener('routesArrayUpdated', this.handleStateChange.bind(this));
},

 handleStateChange(event) {
     // this.displayFlightsForWaypoints();
     this.updateRouteInfoPane(appState.routes);
     findCheapestRoutes.findCheapestRouteAndAddWaypoints();
 },

 // async displayFlightsForWaypoints() {
 //   const waypoints = appState.waypoints;
 //   if (waypoints.length < 2) return;

 //   for (let i = 0; i < waypoints.length - 1; i++) {
 //     const originIata = waypoints[i].iata_code;
 //     const destIata = waypoints[i + 1].iata_code;
 //     await this.displayFlightInfo(originIata, destIata);
 //   }
 // },

 // // New function to fetch and display flight data
 // async displayFlightInfo(originIata, destIata) {
 //   console.log('Fetching flight data for', originIata, destIata);
 //   try {
 //       const response = await fetch(`http://yonderhop.com:3000/flights?origin=${originIata}&destination=${destIata}`);
 //       const flights = await response.json();
 //       this.updateFlightInfoPane(flights);
 //   } catch (error) {
 //       console.error('Error fetching flight data:', error);
 //   }
 // },

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
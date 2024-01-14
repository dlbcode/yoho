import { appState } from './stateManager.js';
import { findCheapestRoutes } from './findCheapestRoutes.js';

const infoPane = {

  init() {
    // Update only the content of infoPaneContent
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

    // Create a table element
    const table = document.createElement('table');
    table.style.width = '100%';
    table.setAttribute('border', '1');

    // Create table header
    const thead = document.createElement('thead');
    let headerRow = `<tr>
                        <th>Origin</th>
                        <th>Destination</th>
                        <th>Price</th>
                     </tr>`;
    thead.innerHTML = headerRow;
    table.appendChild(thead);

    // Create table body
    const tbody = document.createElement('tbody');
    routes.forEach(route => {
        let row = `<tr>
                      <td>${route.originAirport.city} (${route.origin})</td>
                      <td>${route.destinationAirport.city} (${route.destination})</td>
                      <td>${route.price}</td>
                   </tr>`;
        tbody.innerHTML += row;
    });
    table.appendChild(tbody);

    // Append the table to the infoPaneContent
    infoPaneContent.appendChild(table);
  },
};

export { infoPane };
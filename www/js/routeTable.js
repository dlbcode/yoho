import { appState } from './stateManager.js';


function buildRouteTable(routeIndex) {
  const selectedRoute = appState.routes[routeIndex];
  const infoPaneContent = document.getElementById('infoPaneContent');
  infoPaneContent.innerHTML = '';

  const origin = selectedRoute.originAirport.iata_code;
  const destination = selectedRoute.destinationAirport.iata_code;
  const date = "2024-03-15"; // Example date, you might want to dynamically set this

  fetch(`https://yonderhop.com/api/yhoneway?origin=${origin}&destination=${destination}&date=${date}`)
    .then(response => {
      if (!response.ok) {
        throw new Error('Failed to fetch route data');
      }
      return response.json();
    })
    .then(data => {
      const table = document.createElement('table');
      table.className = 'route-info-table';
      table.style.width = '100%';
      table.setAttribute('border', '1');

      const thead = document.createElement('thead');
      let headerRow = `<tr>
                          <th>Departure</th>
                          <th>Arrival</th>
                          <th>Price</th>
                          <th>Airlines</th>
                          <th>Direct</th>
                          <th>Stops</th>
                          <th>Layovers</th>
                          <th>Duration</th>
                          <th>Route</th> <!-- New Column for Route IATAs -->
                       </tr>`;
      thead.innerHTML = headerRow;
      table.appendChild(thead);

      const tbody = document.createElement('tbody');
      data.forEach(flight => {
        let row = document.createElement('tr');
        const directFlight = flight.route.length === 1;
        const stops = flight.route.length - 1;
        const layovers = flight.route.slice(1, -1).map(r => r.flyTo).join(", ");
        const durationHours = Math.floor(flight.duration.total / 3600);
        const durationMinutes = Math.floor((flight.duration.total % 3600) / 60);
        const routeIATAs = flight.route.map(r => r.flyFrom).concat(flight.route[flight.route.length - 1].flyTo).join(" > "); // Concatenating all IATAs
        row.innerHTML = `<td>${new Date(flight.local_departure).toLocaleString()}</td>
                         <td>${new Date(flight.local_arrival).toLocaleString()}</td>
                         <td>$${flight.price}</td>
                         <td>${flight.airlines.join(", ")}</td>
                         <td>${directFlight ? '✓' : ''}</td>
                         <td>${stops}</td>
                         <td>${layovers}</td>
                         <td>${durationHours}h ${durationMinutes}m</td>
                         <td>${routeIATAs}</td>`; // Adding the new Route IATAs column
        tbody.appendChild(row);
      });
      table.appendChild(tbody);
      infoPaneContent.appendChild(table);
    })
    .catch(error => {
      console.error('Error:', error);
      infoPaneContent.textContent = 'Error loading data.';
    });
}

export { buildRouteTable };
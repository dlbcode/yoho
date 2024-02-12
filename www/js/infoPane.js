import { appState, updateState } from './stateManager.js';
import { pathDrawing } from './pathDrawing.js';
import { findCheapestRoutes } from './findCheapestRoutes.js';

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
      button.onclick = () => this.handleRouteInfoClick(index);
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

  handleRouteInfoClick(routeIndex) {
    const selectedRoute = appState.routes[routeIndex];
    console.log('Selected route:', selectedRoute);
    console.log('Route index:', routeIndex);
    const infoPaneContent = document.getElementById('infoPaneContent');
    infoPaneContent.innerHTML = '';

    fetch('https://yonderhop.com/api/airports')
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to fetch airports data');
        }
        return response.json();
      })
      .then(airports => {

        return fetch(`https://yonderhop.com/api/cheapestRoutes?origin=${selectedRoute.originAirport.iata_code}&destination=${selectedRoute.destinationAirport.iata_code}`)
          .then(response => {
            if (!response.ok) {
              throw new Error('Failed to fetch cheapest route data');
            }
            return response.json();
          })
          .then(data => {
            const table = document.createElement('table');
            table.className = 'sortable-table';
            table.style.width = '100%';
            table.setAttribute('border', '1');

            const thead = document.createElement('thead');
            let headerRow = `<tr>
                              <th>Route</th>
                              <th>Estimated Price</th>
                            </tr>`;
            thead.innerHTML = headerRow;
            table.appendChild(thead);

            const tbody = document.createElement('tbody');
            data.forEach(item => {
              let row = document.createElement('tr');
              // Format totalCost as currency
              let formattedTotalCost = `$${parseFloat(item.totalCost).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
              row.innerHTML = `<td>${item.route.join(' -> ')}</td>
                               <td>${formattedTotalCost}</td>`;
              tbody.appendChild(row);

              row.addEventListener('mouseover', () => {
                item.route.forEach((iataCode, index) => {
                  if (index < item.route.length - 1) {
                    const origin = airports.find(airport => airport.iata_code === iataCode);
                    const destination = airports.find(airport => airport.iata_code === item.route[index + 1]);
                    if (origin && destination) {

                      pathDrawing.createRoutePath(origin, destination, { originAirport: origin, destinationAirport: destination, price: item.totalCost });

                      const routeId = `${origin.iata_code}-${destination.iata_code}`;
                      const pathLines = pathDrawing.routePathCache[routeId] || [];
                      pathLines.forEach(path => path.setStyle({ color: 'white' }));
                    }
                  }
                });
              });
              row.addEventListener('mouseout', () => {
                appState.routes.forEach(route => {
                  const routeId = `${route.originAirport.iata_code}-${route.destinationAirport.iata_code}`;
                  const pathLines = pathDrawing.routePathCache[routeId] || [];
                  pathLines.forEach(path => path.setStyle({ color: pathDrawing.getColorBasedOnPrice(route.price) }));
                });
                console.log('mouseout');
                pathDrawing.clearLines();
                pathDrawing.drawLines();
              });

              row.addEventListener('click', () => {
                console.log('Route index:', routeIndex);
                const intermediaryIatas = item.route; // e.g., ["DEN", "YYZ", "YHZ"] for routeIndex 1
                let newWaypoints = [];
                const startIndex = routeIndex * 2;
                newWaypoints = appState.waypoints.slice(0, startIndex);
                intermediaryIatas.forEach((iata, index) => {
                    const waypoint = airports.find(airport => airport.iata_code === iata);
                    if (waypoint) {
                        newWaypoints.push(waypoint);
                        if (index > 0 && index < intermediaryIatas.length - 1) {
                            newWaypoints.push({...waypoint});
                        }
                    }
                });
                const endIndex = startIndex + 2;
                newWaypoints = newWaypoints.concat(appState.waypoints.slice(endIndex));
                appState.waypoints = newWaypoints;
                updateState('updateWaypoint', false);
              });                                                                                                                
            
            });
            table.appendChild(tbody);
            infoPaneContent.appendChild(table);
          });
      })
      .catch(error => {
        console.error('Error:', error);
        infoPaneContent.textContent = 'Error loading data.';
      });
  },

  attachSortingEventListeners(table) {
    table.querySelectorAll(".sort-header").forEach(headerButton => {
      headerButton.addEventListener("click", () => {
        const headerCell = headerButton.parentElement;
        const tableElement = headerCell.parentElement.parentElement.parentElement;
        const headerIndex = Array.prototype.indexOf.call(headerCell.parentNode.children, headerCell);
        const currentIsAscending = headerCell.classList.contains("th-sort-asc");

        this.sortTableByColumn(tableElement, headerIndex, !currentIsAscending);
      });
    });
  },

  sortTableByColumn(table, column, asc = true) {
    const dirModifier = asc ? 1 : -1;
    const tBody = table.tBodies[0];
    const rows = Array.from(tBody.querySelectorAll("tr"));

    const sortedRows = rows.sort((a, b) => {
      const aColText = a.querySelector(`td:nth-child(${column + 1})`).textContent.trim();
      const bColText = b.querySelector(`td:nth-child(${column + 1})`).textContent.trim();

      // Check if the column is a date
      if (aColText.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return (new Date(aColText) - new Date(bColText)) * dirModifier;
      } else if (!isNaN(parseFloat(aColText)) && !isNaN(parseFloat(bColText))) {
        return (parseFloat(aColText) - parseFloat(bColText)) * dirModifier;
      } else {
        return aColText.localeCompare(bColText, undefined, { numeric: true, sensitivity: 'base' }) * dirModifier;
      }
    });

    while (tBody.firstChild) {
      tBody.removeChild(tBody.firstChild);
    }

    tBody.append(...sortedRows);

    table.querySelectorAll("th").forEach(th => th.classList.remove("th-sort-asc", "th-sort-desc"));
    table.querySelector(`th:nth-child(${column + 1})`).classList.toggle("th-sort-asc", asc);
    table.querySelector(`th:nth-child(${column + 1})`).classList.toggle("th-sort-desc", !asc);
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

};

export { infoPane };
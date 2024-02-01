import { appState, updateState } from './stateManager.js';
import { pathDrawing } from './pathDrawing.js';
import { findCheapestRoutes } from './findCheapestRoutes.js';
import { routeHandling } from './routeHandling.js';

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
        };
      });
    });
  },

  handleRouteInfoClick(routeIndex) {
    const selectedRoute = appState.routes[routeIndex];
    const infoPaneContent = document.getElementById('infoPaneContent');
    infoPaneContent.innerHTML = '';

    // Fetch airport data
    fetch('http://127.0.0.1:3000/airports')
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to fetch airports data');
        }
        return response.json();
      })
      .then(airports => {
        // Now fetch the cheapest routes data
        return fetch(`http://127.0.0.1:3000/cheapestRoutes?origin=${selectedRoute.originAirport.iata_code}&destination=${selectedRoute.destinationAirport.iata_code}`)
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
              row.innerHTML = `<td>${item.route.join(' -> ')}</td>
                               <td>${item.totalCost}</td>`;
              tbody.appendChild(row);

              // Add hover effects
              row.addEventListener('mouseover', () => {
                item.route.forEach((iataCode, index) => {
                  if (index < item.route.length - 1) {
                    const origin = airports.find(airport => airport.iata_code === iataCode);
                    const destination = airports.find(airport => airport.iata_code === item.route[index + 1]);
                    if (origin && destination) {
                      // Draw the line for this segment
                      pathDrawing.createRoutePath(origin, destination, { originAirport: origin, destinationAirport: destination, price: item.totalCost });

                      // Change the color of the line to white
                      const routeId = `${origin.iata_code}-${destination.iata_code}`;
                      const pathLines = pathDrawing.routePathCache[routeId] || [];
                      pathLines.forEach(path => path.setStyle({ color: 'white' }));
                    }
                  }
                });
              });
              row.addEventListener('mouseout', () => {
                // Reset the color of all lines to their original state
                appState.routes.forEach(route => {
                  const routeId = `${route.originAirport.iata_code}-${route.destinationAirport.iata_code}`;
                  const pathLines = pathDrawing.routePathCache[routeId] || [];
                  pathLines.forEach(path => path.setStyle({ color: pathDrawing.getColorBasedOnPrice(route.price) }));
                });
              });
              /// Add click event to handle waypoints
              row.addEventListener('click', () => {
                const intermediaryIatas = item.route;
                const originIndex = appState.waypoints.findIndex(wp => wp.iata_code === selectedRoute.originAirport.iata_code);
    
                for (let i = 0; i < intermediaryIatas.length - 1; i++) {
                    const waypointOrigin = airports.find(airport => airport.iata_code === intermediaryIatas[i]);
                    const waypointDestination = airports.find(airport => airport.iata_code === intermediaryIatas[i + 1]);
    
                    if (waypointOrigin && waypointDestination) {
                        // Insert the origin (except for the first element)
                        if (i > 0) {
                            appState.waypoints.splice(originIndex + 1 + (i * 2) - 1, 0, waypointOrigin);
                        }
    
                        // Insert the destination (except for the last element)
                        if (i < intermediaryIatas.length - 2) {
                            appState.waypoints.splice(originIndex + 1 + (i * 2), 0, waypointDestination);
                        }
                    }
                }
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
    routes.forEach(route => {
      let row = document.createElement('tr');
      row.innerHTML = `<td>${route.originAirport.city} (${route.originAirport.iata_code})</td>
                       <td>${route.destinationAirport.city} (${route.destinationAirport.iata_code})</td>
                       <td>${route.price}</td>
                       <td><button class='update-price-btn'>Update Price</button></td>`;
      tbody.appendChild(row);

      // Assuming pathDrawing.js has a method to fetch paths by route
      row.addEventListener('mouseover', () => {
          const routeId = `${route.originAirport.iata_code}-${route.destinationAirport.iata_code}`;
          const pathLines = pathDrawing.routePathCache[routeId] || [];
          pathLines.forEach(path => path.setStyle({ color: 'white' }));
      });

      row.addEventListener('mouseout', () => {
          const routeId = `${route.originAirport.iata_code}-${route.destinationAirport.iata_code}`;
          const pathLines = pathDrawing.routePathCache[routeId] || [];
          pathLines.forEach(path => path.setStyle({ color: pathDrawing.getColorBasedOnPrice(route.price) }));
      });
    });
    table.appendChild(tbody);

    infoPaneContent.appendChild(table);
},
};

export { infoPane };
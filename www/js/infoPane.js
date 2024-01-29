import { appState } from './stateManager.js';
import { pathDrawing } from './pathDrawing.js';
import { findCheapestRoutes } from './findCheapestRoutes.js';

const infoPane = {
    init() {
        const infoPaneContent = document.getElementById('infoPaneContent');
        const mapButton = document.getElementById('mapButton');
        mapButton.addEventListener('click', this.displayAllRoutesSummary.bind(this));
        document.addEventListener('stateChange', this.handleStateChange.bind(this));
    },

    displayAllRoutesSummary: function() {
        this.updateRouteInfoPane(appState.routes);
    },

    handleStateChange(event) {
        this.updateRouteButtons();
        this.updateRouteInfoPane(appState.routes);
        findCheapestRoutes.findCheapestRouteAndAddWaypoints();
    },

    updateRouteButtons: function() {
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

    handleRouteInfoClick: function(routeIndex) {
        const selectedRoute = appState.routes[routeIndex];
        const infoPaneContent = document.getElementById('infoPaneContent');
        infoPaneContent.innerHTML = '';
    
        fetch(`http://yonderhop.com:3000/atcd?origin=${selectedRoute.originAirport.iata_code}&destination=${selectedRoute.destinationAirport.iata_code}&oneWay=${appState.oneWay}`)
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
                                    <th><button class="sort-header">Departure Date</button></th>`;
                if (!appState.oneWay) {
                    headerRow += `<th><button class="sort-header">Return Date</button></th>`;
                }
                headerRow += `<th><button class="sort-header">Price</button></th>
                              </tr>`;
                thead.innerHTML = headerRow;
                table.appendChild(thead);
    
                const tbody = document.createElement('tbody');
                data.forEach(item => {
                    let row = document.createElement('tr');
                    row.innerHTML = `<td>${item.departureDate}</td>`;
                    if (!appState.oneWay) {
                        row.innerHTML += `<td>${item.returnDate}</td>`;
                    }
                    row.innerHTML += `<td>${item.price}</td>`;
                    tbody.appendChild(row);
                });
                table.appendChild(tbody);
    
                infoPaneContent.appendChild(table);
                this.attachSortingEventListeners(table);
            })
            .catch(error => {
                console.error('Error fetching cheapest route data:', error);
                infoPaneContent.textContent = 'Error loading cheapest route data.';
            });
    },        

    attachSortingEventListeners: function(table) {
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

    sortTableByColumn: function(table, column, asc = true) {
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
        });
        table.appendChild(tbody);
    
        infoPaneContent.appendChild(table);
    },    
};

export { infoPane };

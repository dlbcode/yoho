import { appState } from './stateManager.js';

function buildRouteTable(routeIndex) {
  const selectedRoute = appState.routes[routeIndex];
  const infoPaneContent = document.getElementById('infoPaneContent');
  infoPaneContent.innerHTML = '';

  // Load routeTable.css
  document.head.appendChild(Object.assign(document.createElement('link'), {rel: 'stylesheet', type: 'text/css', href: '../css/routeTable.css'}));

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
                          <th>Price <span id="priceFilterIcon">&#x1F50D;</span></th>
                          <th>Airlines</th>
                          <th>Direct</th>
                          <th>Stops</th>
                          <th>Layovers</th>
                          <th>Duration</th>
                          <th>Route</th>
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
        const routeIATAs = flight.route.map(r => r.flyFrom).concat(flight.route[flight.route.length - 1].flyTo).join(" > ");
        row.innerHTML = `<td>${new Date(flight.local_departure).toLocaleString()}</td>
                         <td>${new Date(flight.local_arrival).toLocaleString()}</td>
                         <td>$${flight.price}</td>
                         <td>${flight.airlines.join(", ")}</td>
                         <td>${directFlight ? '✓' : ''}</td>
                         <td>${stops}</td>
                         <td>${layovers}</td>
                         <td>${durationHours}h ${durationMinutes}m</td>
                         <td>${routeIATAs}</td>`;
        tbody.appendChild(row);
      });
      table.appendChild(tbody);
      infoPaneContent.appendChild(table);

      // Add sorting functionality to headers
      const headers = table.querySelectorAll("th");
      headers.forEach((header, index) => {
        if (header.textContent.trim().toLowerCase() !== 'route') {
          header.addEventListener('click', () => {
            const currentIsAscending = header.classList.contains("th-sort-asc");
            sortTableByColumn(table, index, !currentIsAscending);
          });
        }
      });

      // Add filter icon functionality
      document.getElementById('priceFilterIcon').addEventListener('click', function(event) {
        showPriceFilterPopup(event, data);
      });
    })
    .catch(error => {
      console.error('Error:', error);
      infoPaneContent.textContent = 'Error loading data.';
    });
}

function sortTableByColumn(table, column, asc = true) {
  const dirModifier = asc ? 1 : -1;
  const tBody = table.tBodies[0];
  const rows = Array.from(tBody.querySelectorAll("tr"));

  // Adjust column indexes based on your table's structure if necessary
  const isDateColumn = column === 0 || column === 1; // Departure and Arrival columns
  const isPriceColumn = column === 2; // Price column
  const isDurationColumn = column === 7; // Duration column, adjust if your table structure is different

  const sortedRows = rows.sort((a, b) => {
    let aColText = a.querySelector(`td:nth-child(${column + 1})`).textContent.trim();
    let bColText = b.querySelector(`td:nth-child(${column + 1})`).textContent.trim();

    if (isDateColumn) {
      return (new Date(aColText) - new Date(bColText)) * dirModifier;
    } else if (isPriceColumn) {
      aColText = parseFloat(aColText.replace('$', ''));
      bColText = parseFloat(bColText.replace('$', ''));
      return (aColText - bColText) * dirModifier;
    } else if (isDurationColumn) {
      // Convert "XXh YYm" format into total minutes for comparison
      const durationToMinutes = duration => {
        const parts = duration.match(/(\d+)h (\d+)m/);
        if (parts) {
          const hours = parseInt(parts[1], 10);
          const minutes = parseInt(parts[2], 10);
          return hours * 60 + minutes;
        }
        return 0; // Default to 0 if the format doesn't match
      };
      aColText = durationToMinutes(aColText);
      bColText = durationToMinutes(bColText);
    } else if (!isNaN(parseFloat(aColText)) && !isNaN(parseFloat(bColText))) {
      aColText = parseFloat(aColText);
      bColText = parseFloat(bColText);
    } else {
      return aColText.localeCompare(bColText, undefined, { numeric: true, sensitivity: 'base' }) * dirModifier;
    }

    return (aColText - bColText) * dirModifier;
  });

  // Re-append sorted rows to tbody
  while (tBody.firstChild) {
    tBody.removeChild(tBody.firstChild);
  }
  tBody.append(...sortedRows);

  // Update header classes for visual indication of sort direction
  table.querySelectorAll("th").forEach(th => th.classList.remove("th-sort-asc", "th-sort-desc"));
  table.querySelector(`th:nth-child(${column + 1})`).classList.toggle("th-sort-asc", asc);
  table.querySelector(`th:nth-child(${column + 1})`).classList.toggle("th-sort-desc", !asc);
}

function showPriceFilterPopup(event, data) {
  const prices = data.map(flight => flight.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);

  const sliderPopup = document.getElementById('priceSliderPopup') || createSliderPopup();
  const slider = sliderPopup.querySelector('#priceSlider');
  slider.min = minPrice;
  slider.max = maxPrice;
  slider.value = minPrice; // Reset slider value or set to a previously saved value

  sliderPopup.classList.toggle('hidden', false);

  // Find the 'Price' column header to position the popup above it
  const priceHeader = document.querySelector('th:nth-child(3)'); // Assuming 'Price' is the third column
  const rect = priceHeader.getBoundingClientRect();

  // Position above the 'Price' column header
  sliderPopup.style.left = `${rect.left + window.scrollX}px`;
  sliderPopup.style.top = `${rect.top + window.scrollY - sliderPopup.offsetHeight}px`;
}

function createSliderPopup() {
  const sliderPopup = document.createElement('div');
  sliderPopup.id = 'priceSliderPopup';
  sliderPopup.innerHTML = `
    <div id="sliderValueDisplay" style="text-align: center; margin-bottom: 10px;">$50</div>
    <input type="range" min="0" max="100" value="50" class="price-slider" id="priceSlider">
  `;
  document.body.appendChild(sliderPopup);

  const slider = document.getElementById('priceSlider');
  const valueDisplay = document.getElementById('sliderValueDisplay');

  // Initialize display with current slider value
  valueDisplay.textContent = `$${slider.value}`;

  // Update the display when the slider value changes
  slider.addEventListener('input', function() {
    valueDisplay.textContent = `$${this.value}`;
    filterTableByPrice(this.value);
  });

  // Hide the slider popup when clicking outside of it
  document.addEventListener('click', function(event) {
    if (!sliderPopup.contains(event.target) && event.target.id !== 'priceFilterIcon') {
      sliderPopup.classList.add('hidden'); // Use class to hide
    }
  });

  return sliderPopup;
}

function filterTableByPrice(threshold) {
  const table = document.querySelector('.route-info-table');
  const rows = table.querySelectorAll('tbody tr');
  rows.forEach(row => {
    const price = parseFloat(row.cells[2].textContent.replace('$', ''));
    row.style.display = price > threshold ? 'none' : '';
  });
}

export { buildRouteTable };
import { map } from "../map.js";

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

  // Update the displayed price in real-time as the slider moves
  slider.addEventListener('input', function() {
    valueDisplay.textContent = `$${this.value}`;
    filterTableByPrice(this.value);
  });

  document.addEventListener('click', function(event) {
    if (!sliderPopup.contains(event.target) && event.target.id !== 'priceFilterIcon') {
      sliderPopup.classList.add('hidden');
    }
  });

  return sliderPopup;
}

function showPriceFilterPopup(event, data) {
  let prices;

  // Check if data is an array and use it directly
  if (Array.isArray(data)) {
    prices = data.map(flight => flight.price);
  } else if (data && data.data && Array.isArray(data.data)) {
    // If data is an object with a data property that is an array, use that
    prices = data.data.map(flight => flight.price);
  } else {
    // Log an error or handle cases where data is not in the expected format
    console.error('Data provided to showPriceFilterPopup is not in the expected format:', data);
    return; // Exit the function to avoid further errors
  }

  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);

  const sliderPopup = document.getElementById('priceSliderPopup') || createSliderPopup();
const slider = sliderPopup.querySelector('#priceSlider');
const valueDisplay = sliderPopup.querySelector('#sliderValueDisplay');

// Update the slider with the new min and max prices
slider.min = minPrice;
slider.max = maxPrice;
slider.value = maxPrice; // Optionally, reset the slider to the max value or another default

// Update the displayed value
valueDisplay.textContent = `${maxPrice}`;

// Make sure the slider popup is visible
sliderPopup.classList.remove('hidden');

// Position the slider popup appropriately
// This assumes you have a mechanism to position the popup near the price filter icon
const priceHeader = document.querySelector('th:nth-child(3)'); // Assuming price is in the third column
const rect = priceHeader.getBoundingClientRect();
sliderPopup.style.left = `${rect.left + window.scrollX}px`;
sliderPopup.style.top = `${rect.top + window.scrollY - sliderPopup.offsetHeight}px`;
}

function filterTableByPrice(threshold) {
  const table = document.querySelector('.route-info-table');
  const rows = table.querySelectorAll('tbody tr');

  // Reset visibility for all lines
  map.eachLayer(layer => {
    if (layer.routeLineId) {
      // Assume all lines start as non-interactive and hidden
      layer.setStyle({opacity: 0, fillOpacity: 0});
      if (layer._path) {
        layer._path.style.pointerEvents = 'none';
      }
    }
  });

  // Adjust visibility based on the filter
  rows.forEach(row => {
    const price = parseFloat(row.cells[2].textContent.replace('$', ''));
    const isVisible = price <= threshold;
    row.style.display = isVisible ? '' : 'none';

    const routeLineId = row.getAttribute('data-route-id');
    if (isVisible && routeLineId) {
      map.eachLayer(layer => {
        if (layer.routeLineId === routeLineId) {
          // Check if the layer is an invisibleRouteLine by its opacity
          if (layer.options.opacity === 0.2) {
            // Set invisibleRouteLines to their designated opacity and make interactive
            layer.setStyle({opacity: 0.2, fillOpacity: 0.2});
            layer._path.style.pointerEvents = '';
          } else {
            // Set routeLines to full visibility and make interactive
            layer.setStyle({opacity: 1, fillOpacity: 1});
            layer._path.style.pointerEvents = '';
          }
        }
      });
    }
  });
}

export { showPriceFilterPopup };

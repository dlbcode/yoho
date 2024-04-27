import { map } from "../map.js";
import { appState } from '../stateManager.js';

const priceFilter = {
  createSliderPopup: function() {
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
      priceFilter.filterTableByPrice(this.value);
    });

    document.addEventListener('click', function(event) {
      if (!sliderPopup.contains(event.target) && event.target.id !== 'priceFilterIcon') {
        sliderPopup.classList.add('hidden');
      }
    });

    return sliderPopup;
  },

  positionSliderPopup: function() {
    const priceFilter = document.querySelector('#priceFilter');
    const rect = priceFilter.getBoundingClientRect();
    const sliderPopup = document.getElementById('priceSliderPopup');
 
    // Ensure sliderPopup is visible and has a calculated size before positioning
    sliderPopup.style.visibility = 'hidden'; // Hide during calculation to avoid flickering
    sliderPopup.style.height = '';           // Reset any previously set height
    sliderPopup.classList.remove('hidden');  // Remove hidden class to ensure dimensions are calculable
  
    sliderPopup.style.left = `${rect.left + window.scrollX - 80}px`;
    sliderPopup.style.top = `${rect.top + window.scrollY - sliderPopup.offsetHeight -8}px`;
  
    sliderPopup.style.visibility = '';       // Make it visible again
  },
  

  showPriceFilterPopup: function(event, data) {
    let prices;

    if (Array.isArray(data)) {
      prices = data.map(flight => flight.price);
    } else if (data && data.data && Array.isArray(data.data)) {
      prices = data.data.map(flight => flight.price);
    } else {
      console.error('Data provided to showPriceFilterPopup is not in the expected format:', data);
      return; // Exit the function to avoid further errors
    }

    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);

    const sliderPopup = document.getElementById('priceSliderPopup') || this.createSliderPopup();
    const slider = sliderPopup.querySelector('#priceSlider');
    const valueDisplay = sliderPopup.querySelector('#sliderValueDisplay');

    // Update the slider with the new min and max prices
    slider.min = minPrice;
    slider.max = maxPrice;
    slider.value = maxPrice; // Optionally, reset the slider to the max value or another default

    // Update the displayed value
    valueDisplay.textContent = `${maxPrice}`;

    // Position the slider popup each time it is shown
    this.positionSliderPopup();

    // Make sure the slider popup is visible
    sliderPopup.classList.remove('hidden');
  },

  filterTableByPrice: function(threshold) {
  const table = document.querySelector('.route-info-table');
  const rows = table.querySelectorAll('tbody tr:not(.route-info-row)');  // Excludes rows with class 'route-info-row'

  // First, reset visibility for all lines to ensure a clean state
  this.resetLineVisibility();

  // Adjust visibility based on the filter
  rows.forEach(row => {
    const price = parseFloat(row.cells[2].textContent.replace('$', ''));
    const isVisible = price <= threshold;
    row.style.display = isVisible ? '' : 'none';

    if (isVisible) {
      const routeLineId = row.getAttribute('data-route-id');
      // Make routeLines fully visible
      appState.routeLines.forEach(line => {
        if (line.routeLineId === routeLineId) {
          line.setStyle({opacity: 1, fillOpacity: 1});
          line._path.style.pointerEvents = '';
        }
      });
      // Adjust invisibleRouteLines opacity
      appState.invisibleRouteLines.forEach(line => {
        if (line.routeLineId === routeLineId) {
          line.setStyle({opacity: 0.0, fillOpacity: 0.0});
          line._path.style.pointerEvents = 'none';
        }
      });
    }
  });
},


  // Helper function to reset line visibility
  resetLineVisibility: function() {
    appState.routeLines.forEach(line => {
      line.setStyle({opacity: 0, fillOpacity: 0});
      line._path.style.pointerEvents = 'none';
    });
    appState.invisibleRouteLines.forEach(line => {
      line.setStyle({opacity: 0, fillOpacity: 0});
      line._path.style.pointerEvents = 'none';
    });
  }
}

export { priceFilter };

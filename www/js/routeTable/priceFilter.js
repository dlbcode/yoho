import { appState } from '../stateManager.js';
import { logFilterState } from './tableFilter.js';

const priceFilter = {
      createSliderPopup: function() {
        const sliderPopup = document.createElement('div');
        sliderPopup.id = 'priceSliderPopup'; // Static ID, correct and does not depend on variable data
        sliderPopup.className = 'price-filter-popup';
        sliderPopup.innerHTML = `
            <div id="sliderValueDisplay" style="text-align: center; margin-bottom: 10px; color: #ddd"></div>
            <div id="priceSlider" class="price-slider"></div>
        `;
        document.body.appendChild(sliderPopup);

        return sliderPopup;
    },

    loadSliderLibraries: function(data) {
        if (!window.noUiSlider) {
            const script = document.createElement('script');
            script.onload = () => this.initSlider(data);  // Initialize the slider after the library is loaded
            script.src = "https://cdn.jsdelivr.net/npm/nouislider/distribute/nouislider.min.js";
            document.head.appendChild(script);

            const link = document.createElement('link');
            link.rel = "stylesheet";
            link.href = "https://cdn.jsdelivr.net/npm/nouislider/distribute/nouislider.min.css";
            document.head.appendChild(link);
        } else {
            this.initSlider(data);  // Initialize immediately if the script is already present
        }
    },

    initSlider: function(data) {
        const prices = data.map(flight => flight.price);
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);

        const sliderElement = document.getElementById('priceSlider');
        const valueDisplay = document.getElementById('sliderValueDisplay');

        noUiSlider.create(sliderElement, {
            start: [maxPrice / 2],  // Start in the middle of the range
            connect: [true, false],
            range: {
                'min': minPrice,
                'max': maxPrice
            },
            format: {
                to: function(value) {
                    return `$${Math.floor(value)}`;
                },
                from: function(value) {
                    return Number(value.replace('$', ''));
                }
            }
        });

        sliderElement.noUiSlider.on('update', function(values, handle) {
            valueDisplay.textContent = values[handle]; // Display the current slider value
            appState.filterState.price = parseFloat(values[handle].replace('$', ''));
            logFilterState(); // Log the current filter state
        });
    },

    showPriceFilterPopup: function(event, data) {
        let sliderPopup = document.getElementById('priceSliderPopup');
        if (!sliderPopup) {
            sliderPopup = this.createSliderPopup(data);
        }
        sliderPopup.style.position = 'absolute';
        sliderPopup.style.left = `${event.clientX}px`;
        sliderPopup.style.top = `${event.clientY - sliderPopup.offsetHeight}px`;
        sliderPopup.classList.toggle('hidden');
    }
};

export { priceFilter };

// priceFilter.js
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
  const prices = data.map(flight => flight.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);

  const sliderPopup = document.getElementById('priceSliderPopup') || createSliderPopup();
  const slider = sliderPopup.querySelector('#priceSlider');
  slider.min = minPrice;
  slider.max = maxPrice;
  slider.value = minPrice;

  sliderPopup.classList.toggle('hidden', false);

  const priceHeader = document.querySelector('th:nth-child(3)');
  const rect = priceHeader.getBoundingClientRect();

  sliderPopup.style.left = `${rect.left + window.scrollX}px`;
  sliderPopup.style.top = `${rect.top + window.scrollY - sliderPopup.offsetHeight}px`;
}

function filterTableByPrice(threshold) {
  const table = document.querySelector('.route-info-table');
  const rows = table.querySelectorAll('tbody tr');
  rows.forEach(row => {
    const price = parseFloat(row.cells[2].textContent.replace('$', ''));
    row.style.display = price > threshold ? 'none' : '';
  });
}

export { showPriceFilterPopup };

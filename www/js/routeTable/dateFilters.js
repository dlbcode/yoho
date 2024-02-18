function createDateSliderPopup(column) {
  const sliderPopup = document.createElement('div');
  sliderPopup.id = `${column}DateSliderPopup`;
  sliderPopup.classList.add('date-slider-popup');
  sliderPopup.innerHTML = `
    <div id="${column}SliderValueDisplay" style="text-align: center; margin-bottom: 10px;"></div>
    <input type="date" id="${column}MinDate" class="date-slider" value="">
    <input type="date" id="${column}MaxDate" class="date-slider" value="">
  `;
  document.body.appendChild(sliderPopup);

  // Event listeners for date inputs
  const minDateInput = document.getElementById(`${column}MinDate`);
  const maxDateInput = document.getElementById(`${column}MaxDate`);

  minDateInput.addEventListener('change', function() {
    filterTableByDate(column, minDateInput.value, maxDateInput.value);
  });

  maxDateInput.addEventListener('change', function() {
    filterTableByDate(column, minDateInput.value, maxDateInput.value);
  });

  return sliderPopup;
}

function filterTableByDate(column, minDate, maxDate) {
  const table = document.querySelector('.route-info-table');
  const rows = table.querySelectorAll('tbody tr');
  rows.forEach(row => {
    const dateText = row.cells[getColumnIndex(column) - 1].textContent;
    const rowDate = new Date(dateText);
    const isVisible = (!minDate || rowDate >= new Date(minDate)) && (!maxDate || rowDate <= new Date(maxDate));
    row.style.display = isVisible ? '' : 'none';
  });
}

function showDateFilterPopup(event, column, data) {
  // Determine min and max dates from the data
  const dates = data.map(flight => flight[column]);
  const minDate = new Date(Math.min(...dates.map(date => new Date(date))));
  const maxDate = new Date(Math.max(...dates.map(date => new Date(date))));

  const sliderPopup = document.getElementById(`${column}DateSliderPopup`) || createDateSliderPopup(column);
  const minDateInput = sliderPopup.querySelector(`#${column}MinDate`);
  const maxDateInput = sliderPopup.querySelector(`#${column}MaxDate`);

  minDateInput.min = minDate.toISOString().split('T')[0];
  minDateInput.max = maxDate.toISOString().split('T')[0];
  maxDateInput.min = minDate.toISOString().split('T')[0];
  maxDateInput.max = maxDate.toISOString().split('T')[0];
  minDateInput.value = minDate.toISOString().split('T')[0];
  maxDateInput.value = maxDate.toISOString().split('T')[0];

  sliderPopup.classList.toggle('hidden', false);

  // Position the popup
  const header = document.querySelector(`th[data-column="${column}"]`);
  const rect = header.getBoundingClientRect();
  sliderPopup.style.left = `${rect.left + window.scrollX}px`;
  sliderPopup.style.top = `${rect.top + window.scrollY - sliderPopup.offsetHeight}px`;
}

export { showDateFilterPopup };

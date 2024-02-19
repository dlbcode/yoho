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

function parseDate(dateStr) {
  if (typeof dateStr !== 'string') {
    console.error('Invalid or missing date string:', dateStr);
    return new Date(NaN); // Return an invalid date object
  }

  const [datePart, timePart] = dateStr.split(', ');
  const [month, day, year] = datePart.split('/').map(num => parseInt(num, 10));
  const [hourMinute, period] = timePart.split(' ');
  let [hour, minute] = hourMinute.split(':').map(num => parseInt(num, 10));

  // Adjust hour based on AM/PM
  if (period === 'PM' && hour < 12) {
    hour += 12;
  } else if (period === 'AM' && hour === 12) {
    hour = 0;
  }

  // JavaScript months are 0-indexed
  return new Date(year, month - 1, day, hour, minute);
}

function showDateFilterPopup(event, column) {
  // Find the <span> or <img> within <th> that has the matching data-column attribute
  const headerIcon = document.querySelector(`th span[data-column="${column}"], th img[data-column="${column}"]`);
  
  // If the icon or span with the data-column attribute wasn't found, log an error
  if (!headerIcon) {
    console.error(`Element with data-column="${column}" not found.`);
    return;
  }

  // Determine the column index for data processing
  let columnIndex = Array.from(document.querySelectorAll('th')).findIndex(th => 
    th.contains(headerIcon)
  );

  // Extract and process dates from table rows
  const tableRows = document.querySelectorAll('.route-info-table tbody tr');
  const dates = Array.from(tableRows).map(row => {
    const cellText = row.cells[columnIndex]?.textContent.trim();
    return cellText ? parseDate(cellText) : new Date(NaN);
  }).filter(date => !isNaN(date.valueOf()));

  if (dates.length === 0) {
    console.error('No valid dates found for filter');
    return;
  }

  // Calculate minimum and maximum dates
  const minDate = new Date(Math.min(...dates.map(date => date.getTime())));
  const maxDate = new Date(Math.max(...dates.map(date => date.getTime())));

  // Setup or retrieve the slider popup
  const sliderPopup = document.getElementById(`${column}DateSliderPopup`) || createDateSliderPopup(column);
  const minDateInput = sliderPopup.querySelector(`#${column}MinDate`);
  const maxDateInput = sliderPopup.querySelector(`#${column}MaxDate`);

  // Set the input values based on calculated min and max dates
  minDateInput.min = minDate.toISOString().split('T')[0];
  minDateInput.max = maxDate.toISOString().split('T')[0];
  maxDateInput.min = minDate.toISOString().split('T')[0];
  maxDateInput.max = maxDate.toISOString().split('T')[0];
  minDateInput.value = minDate.toISOString().split('T')[0];
  maxDateInput.value = maxDate.toISOString().split('T')[0];

  // Show the slider popup
  sliderPopup.classList.remove('hidden');

  // Position the popup based on the parent <th> element of the found icon/span
  const rect = headerIcon.closest('th').getBoundingClientRect();
  sliderPopup.style.left = `${rect.left + window.scrollX}px`;
  sliderPopup.style.top = `${rect.top + window.scrollY - sliderPopup.offsetHeight}px`;
}

export { showDateFilterPopup };

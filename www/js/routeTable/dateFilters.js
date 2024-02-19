function createDateFilterPopup(column) {
  const filterPopup = document.createElement('div');
  filterPopup.id = `${column}DateFilterPopup`;
  filterPopup.classList.add('date-filter-popup');
  filterPopup.innerHTML = `
    <div id="${column}FilterValueDisplay" style="text-align: center; margin-bottom: 10px;"></div>
    <label for="${column}StartDate">Start Date:</label>
    <select id="${column}StartDate" class="date-filter"></select>
    <label for="${column}EndDate">End Date:</label>
    <select id="${column}EndDate" class="date-filter"></select>
  `;
  document.body.appendChild(filterPopup);

  populateDateDropdowns(column);
}

function populateDateDropdowns(column) {
  const table = document.querySelector('.route-info-table');
  const columnIndex = getColumnIndex(column) - 1;
  // Extract dates, convert to ISO date strings, and remove duplicates
  const dates = Array.from(new Set(Array.from(table.querySelectorAll('tbody tr'))
    .map(row => new Date(row.cells[columnIndex]?.textContent.split(' ')[0]).toISOString().split('T')[0])))
    .sort();

  const startDateSelect = document.getElementById(`${column}StartDate`);
  const endDateSelect = document.getElementById(`${column}EndDate`);

  dates.forEach(date => {
    const formattedDate = formatDate(date); // Assuming formatDate formats ISO string to desired format
    startDateSelect.add(new Option(formattedDate, date));
    endDateSelect.add(new Option(formattedDate, date));
  });

  startDateSelect.addEventListener('change', () => filterDates(endDateSelect, dates, startDateSelect.value));
  endDateSelect.addEventListener('change', () => filterDates(startDateSelect, dates, null, endDateSelect.value));
}

function filterDates(dropdown, dates, minDate, maxDate = '9999-12-31') {
  const currentSelection = dropdown.value;
  dropdown.innerHTML = '';

  dates.forEach(date => {
    if ((minDate === null || date >= minDate) && date <= maxDate) {
      const formattedDate = formatDate(date); // Use the same date formatting as when populating
      dropdown.add(new Option(formattedDate, date, false, date === currentSelection));
    }
  });
  if (!dropdown.querySelector(`option[value="${currentSelection}"]`)) {
    dropdown.value = minDate ? minDate : dropdown.options[0].value;
  }
}

function getColumnIndex(columnIdentifier) {
  const columnMap = {
    'departure': 1,
    'arrival': 2,
    // Add other columns as necessary
  };
  return columnMap[columnIdentifier] || -1; // Default to -1 if identifier not found
}

function formatDate(isoDateString) {
  // Placeholder for date formatting, adjust as needed
  // This function assumes dates are in ISO format ('YYYY-MM-DD') and converts them to a more user-friendly format
  // Example: '2023-01-01' -> 'Jan 01, 2023'
  const date = new Date(isoDateString);
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function showDateFilterPopup(event, column) {
  let existingPopup = document.getElementById(`${column}DateFilterPopup`);
  if (!existingPopup) {
    createDateFilterPopup(column);
  } else {
    // If the popup already exists, simply toggle its visibility
    existingPopup.classList.toggle('hidden');
  }
  
  // Adjust positioning if necessary here
}

export { showDateFilterPopup };

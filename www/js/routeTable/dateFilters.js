function createDateFilterPopup(column) {
  const filterPopup = document.createElement('div');
  filterPopup.id = `${column}DateFilterPopup`;
  filterPopup.classList.add('date-filter-popup');
  filterPopup.innerHTML = `
    <div id="${column}FilterValueDisplay" style="text-align: center; margin-bottom: 10px;"></div>
    <label for="${column}StartDate">Start Date:</label>
    <input type="date" id="${column}StartDate" class="date-filter" value="">
    <label for="${column}EndDate">End Date:</label>
    <input type="date" id="${column}EndDate" class="date-filter" value="">
  `;
  document.body.appendChild(filterPopup);

  // Event listeners for date inputs
  const startDateInput = document.getElementById(`${column}StartDate`);
  const endDateInput = document.getElementById(`${column}EndDate`);

  startDateInput.addEventListener('change', function() {
    filterTableByDate(column, startDateInput.value, endDateInput.value);
  });

  endDateInput.addEventListener('change', function() {
    filterTableByDate(column, startDateInput.value, endDateInput.value);
  });

  return filterPopup;
}

function filterTableByDate(column, startDate, endDate) {
  const table = document.querySelector('.route-info-table');
  const rows = table.querySelectorAll('tbody tr');
  rows.forEach(row => {
    const dateText = row.cells[getColumnIndex(column) - 1].textContent;
    const rowDate = new Date(dateText);
    const isVisible = (!startDate || rowDate >= new Date(startDate)) && (!endDate || rowDate <= new Date(endDate));
    row.style.display = isVisible ? '' : 'none';
  });
}

function getColumnIndex(columnIdentifier) {
  const columnMap = {
    'departure': 1,
    'arrival': 2,
    // Add other columns as necessary
  };
  return columnMap[columnIdentifier] || -1; // Default to -1 if identifier not found
}

function showDateFilterPopup(event, column) {
  // Prevent duplicate popups
  let existingPopup = document.getElementById(`${column}DateFilterPopup`);
  if (existingPopup) {
    existingPopup.remove();
  }

  const filterPopup = createDateFilterPopup(column);

  // Calculate and set the minimum and maximum dates for the start and end date inputs
  // This logic may depend on the data available in your application

  // Position the popup
  const headerIcon = event.target.closest('th');
  const rect = headerIcon.getBoundingClientRect();
  filterPopup.style.left = `${rect.left + window.scrollX}px`;
  filterPopup.style.top = `${rect.top + window.scrollY - filterPopup.offsetHeight}px`;

  // Remove 'hidden' class to display the popup
  filterPopup.classList.remove('hidden');
}

export { showDateFilterPopup };

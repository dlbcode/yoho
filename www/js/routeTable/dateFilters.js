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
  const dateStrings = Array.from(table.querySelectorAll('tbody tr'))
    .map(row => row.cells[columnIndex]?.textContent.split(',')[0]); // Extract just the date part

  const uniqueDates = Array.from(new Set(dateStrings)).sort();

  const startDateSelect = document.getElementById(`${column}StartDate`);
  const endDateSelect = document.getElementById(`${column}EndDate`);

  uniqueDates.forEach(dateStr => {
    startDateSelect.add(new Option(dateStr, dateStr));
    endDateSelect.add(new Option(dateStr, dateStr));
  });

  startDateSelect.addEventListener('change', () => filterDates(endDateSelect, uniqueDates, startDateSelect.value));
  endDateSelect.addEventListener('change', () => filterDates(startDateSelect, uniqueDates, null, endDateSelect.value));
}

function filterDates(dropdown, dates, minDate, maxDate = '9999-12-31') {
  const currentSelection = dropdown.value;
  dropdown.innerHTML = '';

  dates.forEach(date => {
    if ((minDate === null || date >= minDate) && date <= maxDate) {
      dropdown.add(new Option(date, date, false, date === currentSelection));
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
  };
  return columnMap[columnIdentifier] || -1;
}

function showDateFilterPopup(event, column) {
  let existingPopup = document.getElementById(`${column}DateFilterPopup`);
  if (!existingPopup) {
    createDateFilterPopup(column);
  } else {
    existingPopup.classList.toggle('hidden');
  }
}

export { showDateFilterPopup };

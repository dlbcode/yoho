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
  return filterPopup;
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

  startDateSelect.addEventListener('change', () => {
    filterTableByDates(column, startDateSelect.value, endDateSelect.value);
  });
  endDateSelect.addEventListener('change', () => {
    filterTableByDates(column, startDateSelect.value, endDateSelect.value);
  });
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
    existingPopup = createDateFilterPopup(column);
    document.body.appendChild(existingPopup);
  } else {
    existingPopup.classList.toggle('hidden');
  }
  
  if (!existingPopup.classList.contains('hidden')) {
    requestAnimationFrame(() => {
      const header = event.target.closest('th');
      if (header) {
        const rect = header.getBoundingClientRect();
        existingPopup.style.left = `${rect.left + window.scrollX}px`;
        existingPopup.style.top = `${rect.top + window.scrollY - existingPopup.offsetHeight}px`;
      }
    });
  }
}

function filterTableByDates(column, minDate, maxDate) {
  const table = document.querySelector('.route-info-table');
  const columnIndex = getColumnIndex(column) - 1; // Adjust based on your column indexing
  const rows = table.querySelectorAll('tbody tr');

  rows.forEach(row => {
    const dateText = row.cells[columnIndex]?.textContent.split(',')[0];
    const date = new Date(dateText);

    // Hide rows that don't meet the date criteria
    if ((minDate && date < new Date(minDate)) || (maxDate && date > new Date(maxDate))) {
      row.style.display = 'none';
    } else {
      row.style.display = ''; // Show rows that meet the criteria
    }
  });
}

// Global click listener to hide popup if click occurred outside
document.addEventListener('click', function(event) {
  const datePopups = document.querySelectorAll('.date-filter-popup');
  datePopups.forEach(popup => {
    if (!popup.contains(event.target) && !event.target.closest('.filterIcon')) {
      popup.classList.add('hidden');
    }
  });
});

export { showDateFilterPopup };

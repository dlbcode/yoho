import { appState } from '../stateManager.js';

function logFilterState() {
    console.log('Current Filter State:', JSON.stringify(appState.filterState));
}

function applyFilters() {
    const table = document.querySelector('.route-info-table');
    const rows = table.querySelectorAll('tbody tr');

    rows.forEach(row => {
        const departureCell = row.cells[getColumnIndex('departure')];
        const arrivalCell = row.cells[getColumnIndex('arrival')];
        const priceCell = row.cells[getColumnIndex('price')];

        const departure = departureCell ? parseTime(departureCell.textContent) : null;
        const arrival = arrivalCell ? parseTime(arrivalCell.textContent) : null;
        const price = priceCell ? parseFloat(priceCell.textContent.replace(/[^0-9.]+/g, "")) : null;

        const departureFilter = appState.filterState.departure;
        const arrivalFilter = appState.filterState.arrival;
        const priceFilter = appState.filterState.price;

        const isDepartureMatch = departure !== null && departure >= departureFilter.start && departure <= departureFilter.end;
        const isArrivalMatch = arrival !== null && arrival >= arrivalFilter.start && arrival <= arrivalFilter.end;
        const isPriceMatch = price !== null && price === priceFilter.value;

        if (isDepartureMatch && isArrivalMatch && isPriceMatch) {
            row.style.display = ''; // Show row
        } else {
            row.style.display = 'none'; // Hide row
        }
    });
}

function parseTime(timeStr) {
    const time = timeStr.split(', ')[1].split(' ')[1];  // Assumes format "Day Month/Date/Year, Time AM/PM"
    const parts = time.split(':');
    const hours = parseInt(parts[0]) + (time.includes('PM') && parseInt(parts[0]) < 12 ? 12 : 0);
    const minutes = parseInt(parts[1].substring(0, 2));
    return hours * 60 + minutes; // Convert time to minutes since midnight for easier comparison
}

function getColumnIndex(columnIdentifier) {
    const columnMap = {
        'departure': 0,
        'arrival': 1,
        'price': 2,
        'airlines': 3,
        'direct': 4,
        'stops': 5,
        'layovers': 6,
        'duration': 7,
        'route': 8
    };
    return columnMap[columnIdentifier] || -1; // Default to -1 if identifier not found
}

export { logFilterState, applyFilters };

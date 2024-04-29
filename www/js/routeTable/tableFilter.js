import { appState } from '../stateManager.js';

function logFilterState() {
    console.log('Current Filter State:', JSON.stringify(appState.filterState));
}

function applyFilters() {
    const table = document.querySelector('.route-info-table');
    const rows = table.querySelectorAll('tbody tr');

    rows.forEach(row => {
        const departure = parseTime(row.cells[getColumnIndex('departure')].textContent);
        const arrival = parseTime(row.cells[getColumnIndex('arrival')].textContent);
        const price = parseFloat(row.cells[getColumnIndex('price')].textContent.replace(/[^\d.]/g, ''));

        const departureFilter = appState.filterState.departure;
        const arrivalFilter = appState.filterState.arrival;
        const priceFilter = appState.filterState.price;

        const isDepartureMatch = departure >= departureFilter.start && departure <= departureFilter.end;
        const isArrivalMatch = arrival >= arrivalFilter.start && arrival <= arrivalFilter.end;
        const isPriceMatch = price === priceFilter.value;

        if (isDepartureMatch && isArrivalMatch && isPriceMatch) {
            row.style.display = ''; // Show row
        } else {
            row.style.display = 'none'; // Hide row
        }
    });
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
    return columnMap[columnIdentifier] || -1;
}

function parseTime(timeStr) {
    const parts = timeStr.split(':');
    return parseInt(parts[0]) * 60 + parseInt(parts[1]); // Convert time to minutes since midnight for easier comparison
}

export { logFilterState, applyFilters };

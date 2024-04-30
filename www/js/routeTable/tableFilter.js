import { appState } from '../stateManager.js';

function logFilterState() {
    console.log('Current Filter State:', JSON.stringify(appState.filterState));
}

function applyFilters() {
    const table = document.querySelector('.route-info-table');
    const rows = table.querySelectorAll('tbody tr');

    rows.forEach(row => {
        const price = parseFloat(row.cells[getColumnIndex('price')].textContent.replace(/[$,]/g, ''));
        const isVisible = price <= appState.filterState.price.value;

        row.style.display = isVisible ? '' : 'none';
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
    return columnMap[columnIdentifier] || -1; // Default to -1 if identifier not found
}

export { logFilterState, applyFilters };

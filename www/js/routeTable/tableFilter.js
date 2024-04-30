import { appState } from '../stateManager.js';

function logFilterState() {
    console.log('Current Filter State:', JSON.stringify(appState.filterState));
}

function applyFilters() {
    const table = document.querySelector('.route-info-table');
    const rows = table.querySelectorAll('tbody tr');

    // Reset visibility for all related graphical elements
    resetLineVisibility();

    rows.forEach(row => {
        const price = parseFloat(row.cells[getColumnIndex('price')].textContent.replace(/[$,]/g, ''));
        const isVisible = price <= appState.filterState.price.value;
        const routeLineId = row.getAttribute('data-route-id');  // Moved this line outside of the if-else structure

        row.style.display = isVisible ? '' : 'none';

        // Additional handling for graphical elements associated with rows
        if (isVisible) {
            appState.routeLines.forEach(line => {
                if (line.routeLineId === routeLineId) {
                    line.setStyle({opacity: 1, fillOpacity: 1});
                    line._path.style.pointerEvents = '';
                }
            });
        } else {
            appState.invisibleRouteLines.forEach(line => {
                if (line.routeLineId === routeLineId) {
                    line.setStyle({opacity: 0.0, fillOpacity: 0.0});
                    line._path.style.pointerEvents = 'none';
                }
            });
        }
    });
}

function resetLineVisibility() {
    if (appState.routeLines && appState.invisibleRouteLines) {
        appState.routeLines.concat(appState.invisibleRouteLines).forEach(line => {
            line.setStyle({opacity: 0, fillOpacity: 0});
            line._path.style.pointerEvents = 'none';
        });
    }
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

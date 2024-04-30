import { appState } from '../stateManager.js';

function logFilterState() {
    console.log('Current Filter State:', JSON.stringify(appState.filterState));
}

function applyFilters() {
    const table = document.querySelector('.route-info-table');
    const rows = table.querySelectorAll('tbody tr');

    resetLineVisibility();  // Reset visibility for all related graphical elements

    rows.forEach(row => {
        // Ensure that the row has enough cells
        if (row.cells.length < getColumnIndex('arrival') + 1) {
            console.error('Row has insufficient cells:', row);
            return;  // Skip this row to prevent errors
        }

        const priceText = row.cells[getColumnIndex('price')].textContent;
        const departureText = row.cells[getColumnIndex('departure')].textContent;
        const arrivalText = row.cells[getColumnIndex('arrival')].textContent;

        const price = parseFloat(priceText.replace(/[$,]/g, ''));
        const departureTime = parseTime(departureText);
        const arrivalTime = parseTime(arrivalText);

        const priceVisible = price <= appState.filterState.price.value;
        const departureVisible = departureTime >= appState.filterState.departure.start && departureTime <= appState.filterState.departure.end;
        const arrivalVisible = arrivalTime >= appState.filterState.arrival.start && arrivalTime <= appState.filterState.arrival.end;

        const isVisible = priceVisible && departureVisible && arrivalVisible;
        row.style.display = isVisible ? '' : 'none';

        updateLineVisibility(isVisible, row);
    });
}


function updateLineVisibility(isVisible, row) {
    const routeLineId = row.getAttribute('data-route-id');
    (isVisible ? appState.routeLines : appState.invisibleRouteLines).forEach(line => {
        if (line.routeLineId === routeLineId) {
            line.setStyle({opacity: isVisible ? 1 : 0, fillOpacity: isVisible ? 1 : 0});
            line._path.style.pointerEvents = isVisible ? '' : 'none';
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

function parseTime(timeStr) {
    const timePart = timeStr.split(', ')[1]; // Gets the "7:30:00 AM" part
    let [time, modifier] = timePart.split(' ');
    let [hours, minutes] = time.split(':').map(Number);

    hours = modifier === 'PM' && hours < 12 ? hours + 12 : hours;
    hours = modifier === 'AM' && hours === 12 ? 0 : hours; // Convert 12 AM to 0 hours

    return hours + minutes / 60; // Converts time to decimal hours
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
    return columnMap[columnIdentifier] !== undefined ? columnMap[columnIdentifier] : -1;
}

export { logFilterState, applyFilters };

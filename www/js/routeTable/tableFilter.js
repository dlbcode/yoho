import { appState } from '../stateManager.js';

function logFilterState() {
    console.log('Current Filter State:', JSON.stringify(appState.filterState));
}

function applyFilters() {
    const table = document.querySelector('.route-info-table');
    const rows = table.querySelectorAll('tbody tr');

    console.log('table:', table);

    rows.forEach(row => {
        // Safely get text content from a cell, or return null if the cell is undefined
        const safeGetText = (cell) => cell ? cell.textContent : null;

        const departureText = safeGetText(row.cells[getColumnIndex('departure')]);
        const arrivalText = safeGetText(row.cells[getColumnIndex('arrival')]);
        const priceText = safeGetText(row.cells[getColumnIndex('price')]);

        const departure = departureText ? parseTime(departureText) : null;
        const arrival = arrivalText ? parseTime(arrivalText) : null;
        const price = priceText ? parseFloat(priceText.replace(/[^\d.]/g, '')) : null;

        const departureFilter = appState.filterState.departure || {start: 0, end: 24};
        const arrivalFilter = appState.filterState.arrival || {start: 0, end: 24};
        const priceFilter = appState.filterState.price || {value: price};  // Default to current price if undefined

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
    if (!timeStr) {
        console.error('Time string is undefined or empty');
        return null; // Ensure no further processing if input is empty
    }

    try {
        // Split the string by comma and then by space to isolate time components safely
        const parts = timeStr.split(', ');
        if (parts.length < 2) {
            console.error('Incorrect time format:', timeStr);
            return null;
        }

        const timePart = parts[1].split(' ')[0]; // Safely attempt to access the first part of the time
        const amPmMatch = parts[1].match(/AM|PM/i);
        
        if (!timePart || !amPmMatch) {
            console.error('Missing time components in:', timeStr);
            return null;
        }

        let [hours, minutes] = timePart.split(':').map(Number);
        const amPm = amPmMatch[0];

        if (isNaN(hours) || isNaN(minutes)) {
            console.error('Failed to parse hours or minutes:', timeStr);
            return null;
        }

        // Adjust hours for AM/PM
        if (amPm.toUpperCase() === 'PM' && hours < 12) hours += 12;
        if (amPm.toUpperCase() === 'AM' && hours === 12) hours = 0;

        return hours * 60 + minutes; // Convert time to minutes since midnight for easier comparison
    } catch (error) {
        console.error('Failed to parse time due to incorrect format:', timeStr, error);
        return null;
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

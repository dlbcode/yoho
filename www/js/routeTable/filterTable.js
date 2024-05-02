import { appState } from '../stateManager.js';
import { sliderFilter } from './sliderFilter.js';

function logFilterState() {
    //console.log('Current Filter State:', JSON.stringify(appState.filterState));
}

function applyFilters() {
    const table = document.querySelector('.route-info-table');
    const rows = table.querySelectorAll('tbody tr');

    resetLineVisibility();

    rows.forEach(row => {
        if (row.classList.contains('route-info-row')) {
            return;
        }

        const priceText = row.cells[getColumnIndex('price')].textContent;
        const departureText = row.cells[getColumnIndex('departure')].textContent;
        const arrivalText = row.cells[getColumnIndex('arrival')].textContent;

        const price = parseFloat(priceText.replace(/[$,]/g, ''));
        const departureTime = parseTime(departureText);
        const arrivalTime = parseTime(arrivalText);

        const priceVisible = appState.filterState.price && price <= appState.filterState.price.value;
        const departureVisible = departureTime >= appState.filterState.departure.start && departureTime <= appState.filterState.departure.end;
        const arrivalVisible = arrivalTime >= appState.filterState.arrival.start && arrivalTime <= appState.filterState.arrival.end;

        const isVisible = (appState.filterState.price ? priceVisible : true) && departureVisible && arrivalVisible;
        row.style.display = isVisible ? '' : 'none';

        updateLineVisibility(isVisible, row);
    });
    updateFilterHeaders();
}

function updateLineVisibility(isVisible, row) {
    const routeLineId = row.getAttribute('data-route-id');

    const linesToUpdate = isVisible ? [...appState.routeLines, ...appState.invisibleRouteLines] : appState.invisibleRouteLines;

    linesToUpdate.forEach(line => {
    if (line.routeLineId === routeLineId) {
        const isLineInvisible = appState.invisibleRouteLines.includes(line);
        let opacity;
        if (isLineInvisible && isVisible) {
            opacity = 0;
        } else if (!isLineInvisible && isVisible) {
            opacity = 1;
        } else {
            opacity = 0;
        }
        line.setStyle({opacity: opacity, fillOpacity: isVisible ? 1 : 0});
        line._path.style.pointerEvents = isVisible ? '' : 'none';
    }
});
}

function resetLineVisibility() {
    if (appState.routeLines) {
        appState.routeLines.forEach(line => {
            let opacity = 0;  // Since resetting visibility should hide lines, set opacity to 0
            let isVisible = false;  // We assume lines are not visible when reset
            line.setStyle({ opacity: opacity, fillOpacity: isVisible ? 1 : 0 });
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

function updateFilterHeaders() {
    const filterTypes = ['price', 'departure', 'arrival'];
    filterTypes.forEach(type => {
        const filterIcon = document.getElementById(`${type}Filter`);
        if (!filterIcon) {
            console.error(`Filter icon for ${type} not found.`);
            return;
        }

        const filterValue = appState.filterState[type];
        const filterTextElement = document.getElementById(`${type}Text`);
        //const resetButtonId = `reset${type.charAt(0).toUpperCase() + type.slice(1)}`;
        //const resetButton = document.getElementById(resetButtonId);
//
        //if (filterValue && !resetButton) {
        //    const resetButtonHTML = `<span id="${resetButtonId}" style="margin-left: 5px; cursor: pointer;">&#x2715;</span>`;
        //    filterIcon.insertAdjacentHTML('afterend', resetButtonHTML);
        //    document.getElementById(resetButtonId).addEventListener('click', () => {
        //        if (type === 'departure' || type === 'arrival') {
        //            appState.filterState[type] = { start: 0, end: 24 };
        //        } else {
        //            appState.filterState[type] = null;  // For price or other filters
        //        }
        //        applyFilters();
        //    });
        //} else if (resetButton) {
        //    if (type === 'departure' || type === 'arrival') {
        //        resetButton.style.display = filterValue && (filterValue.start != 0 || filterValue.end != 24) ? '' : 'none';
        //    } else {
        //        resetButton.style.display = filterValue ? '' : 'none';
        //    }
        //}

        if (filterTextElement) {
            filterTextElement.textContent = filterValue ? `$${filterValue.value}` : `${type.charAt(0).toUpperCase() + type.slice(1)}`;
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
    return columnMap[columnIdentifier] !== undefined ? columnMap[columnIdentifier] : -1;
}

function toggleFilterResetIcon(column) {
    const filterIcon = document.getElementById(`${column}Filter`);
    const resetIcon = document.getElementById(`reset${column.charAt(0).toUpperCase() + column.slice(1)}Filter`);
    const filterValue = appState.filterState[column];

    const isNonDefault = filterValue && (
        (column === 'price' && filterValue.value) ||
        (column === 'departure' || column === 'arrival') &&
        (filterValue.start !== 0 || filterValue.end !== 24)
    );

    if (isNonDefault) {
        filterIcon.style.display = 'none';
        resetIcon.style.display = 'inline';
    } else {
        filterIcon.style.display = 'inline';
        resetIcon.style.display = 'none';
    }
}

export { logFilterState, applyFilters, toggleFilterResetIcon };

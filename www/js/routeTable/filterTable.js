import { appState, updateState } from '../stateManager.js';
import { sliderFilter } from './sliderFilter.js';
import { lineManager } from '../lineManager.js';

function logFilterState() {
    //console.log('Current Filter State:', JSON.stringify(appState.filterState));
}

function constructFilterTags() {
    const filterTags = [];

    if (appState.filterState.price && appState.filterState.price.value) {
        const maxPrice = appState.filterState.price.value;
        if (maxPrice < 100) {
            filterTags.push('price-range:0-100');
        } else if (maxPrice < 200) {
            filterTags.push('price-range:0-100', 'price-range:100-200');
        } else if (maxPrice < 300) {
            filterTags.push('price-range:0-100', 'price-range:100-200', 'price-range:200-300');
        } else if (maxPrice < 400) {
            filterTags.push('price-range:0-100', 'price-range:100-200', 'price-range:200-300', 'price-range:300-400');
        } else if (maxPrice < 500) {
            filterTags.push('price-range:0-100', 'price-range:100-200', 'price-range:200-300', 'price-range:300-400', 'price-range:400-500');
        } else {
            filterTags.push('price-range:0-100', 'price-range:100-200', 'price-range:200-300', 'price-range:300-400', 'price-range:400-500', 'price-range:500+');
        }
    }

    if (appState.filterState.departure) {
        const { start, end } = appState.filterState.departure;
        if (start < 6 && end > 0) filterTags.push('departure-range:00-06');
        if (start < 12 && end > 6) filterTags.push('departure-range:06-12');
        if (start < 18 && end > 12) filterTags.push('departure-range:12-18');
        if (end > 18) filterTags.push('departure-range:18-24');
    }

    if (appState.filterState.arrival) {
        const { start, end } = appState.filterState.arrival;
        if (start < 6 && end > 0) filterTags.push('arrival-range:00-06');
        if (start < 12 && end > 6) filterTags.push('arrival-range:06-12');
        if (start < 18 && end > 12) filterTags.push('arrival-range:12-18');
        if (end > 18) filterTags.push('arrival-range:18-24');
    }

    const currentRouteIndex = appState.currentRouteIndex;
    if (currentRouteIndex != null) {
        filterTags.push(`group:${currentRouteIndex + 1}`);
    }

    return filterTags;
}

function applyFilters() {
    const tableRows = document.querySelectorAll('.route-info-table tbody tr');
    const filterTags = constructFilterTags();
    const matchingLines = lineManager.getLinesByTags(filterTags, 'route');

    tableRows.forEach(row => {
        const routeId = row.getAttribute('data-route-id');

        // Only hide if there are matching lines AND this row doesn't match
        if (matchingLines.length > 0) {
            const hasMatchingLine = matchingLines.some(line => line.routeId === routeId);
            row.style.display = hasMatchingLine ? '' : 'none';
        } else {
            row.style.display = ''; // Show by default if no matching lines
        }
    });
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
        if (filterTextElement) {
            filterTextElement.textContent = filterValue ? (type === 'price' ? `$${filterValue.value}` : `${formatTime(filterValue.start)} - ${formatTime(filterValue.end)}`) : `${type.charAt(0).toUpperCase() + type.slice(1)}`;
        }
    });
}

function formatTime(decimalTime) {
    const hours = Math.floor(decimalTime);
    const minutes = Math.round((decimalTime - hours) * 60);
    const period = hours < 12 ? 'AM' : 'PM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
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
    if (!filterIcon) {
        console.error(`Filter icon for ${column} not found.`);
        return;
    }

    const resetIcon = document.getElementById(`reset${column.charAt(0).toUpperCase() + column.slice(1)}Filter`);
    if (!resetIcon) {
        console.error(`Reset icon for ${column} not found.`);
        return;
    }

    let filterButtonSpan = filterIcon.closest('.headerText') || filterIcon.closest('.filterButton');
    if (!filterButtonSpan) {
        console.error('Parent span with class .headerText or .filterButton not found for filterIcon.');
        return;
    }

    const filterValue = appState.filterState[column];
    const isNonDefault = filterValue && ((column === 'price' && filterValue.value !== undefined) ||
        (column === 'departure' || column === 'arrival') && (filterValue.start !== 0 || filterValue.end !== 24));

    if (isNonDefault) {
        filterIcon.style.display = 'none';
        resetIcon.style.display = 'inline';
        filterButtonSpan.classList.add('filterButton');
        filterButtonSpan.classList.remove('headerText');
    } else {
        filterIcon.style.display = 'inline';
        resetIcon.style.display = 'none';
        filterButtonSpan.classList.remove('filterButton');
        filterButtonSpan.classList.add('headerText');
    }
}

document.addEventListener('click', function (e) {
    if (e.target.classList.contains('resetIcon')) {
        const column = e.target.getAttribute('data-column');
        const filterIcon = document.querySelector(`#${column}Filter`);
        const filterButtonSpan = filterIcon.closest('.filterButton');
        const resetIcon = e.target;

        // Reset the filter state for the specific column
        if (column === 'departure' || column === 'arrival') {
            appState.filterState[column] = { start: 0, end: 24 };
        } else if (column === 'price') {
            appState.filterState[column] = { value: null };
        }

        // Update UI elements
        filterIcon.style.display = 'inline';
        resetIcon.style.display = 'none';
        if (filterButtonSpan) {
            filterButtonSpan.classList.remove('filterButton');
            filterButtonSpan.classList.add('headerText');
        }

        // Reapply filters
        applyFilters();
        // Update filter header text
        updateFilterHeaders();
    }
});

export { logFilterState, applyFilters, toggleFilterResetIcon, updateFilterHeaders, constructFilterTags };
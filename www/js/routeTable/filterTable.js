import { appState, updateState } from '../stateManager.js';
import { pathDrawing, Line } from '../pathDrawing.js';
import { map } from '../map.js';

function addTimeFilterTags(type, filterTags) {
    const time = appState.filterState[type];
    if (!time) return;
    const { start, end } = time;
    if (start < 6 && end > 0) filterTags.push(`${type}-range:00-06`);
    if (start < 12 && end > 6) filterTags.push(`${type}-range:06-12`);
    if (start < 18 && end > 12) filterTags.push(`${type}-range:12-18`);
    if (end > 18) filterTags.push(`${type}-range:18-24`);
}

function constructFilterTags() {
    const filterTags = [];
    const priceState = appState.filterState.price;
    if (priceState && priceState.value) {
        filterTags.push(`price:${priceState.value}`);
    }
    addTimeFilterTags('departure', filterTags);
    addTimeFilterTags('arrival', filterTags);

    const currentRouteIndex = appState.currentRouteIndex;
    if (currentRouteIndex != null) {
        filterTags.push(`group:${currentRouteIndex + 1}`);
    }
    return filterTags;
}

function checkTimeRange(tagPrefix, timeValue, filterTags) {
    const relevantTags = filterTags.filter(tag => tag.startsWith(tagPrefix));
    if (!relevantTags.length) return true;
    return relevantTags.some(tag => {
        const [start, end] = tag.replace(tagPrefix, '').split('-').map(Number);
        return timeValue >= start && timeValue <= end;
    });
}

function applyFilters() {
    const tableRows = document.querySelectorAll('.route-info-table tbody tr');
    const filterTags = constructFilterTags();
    const visibleRouteIds = new Set();
    const maxPrice = appState.filterState.price?.value;

    tableRows.forEach(row => {
        const routeCell = row.querySelector('td:nth-child(9)');
        if (!routeCell) return;

        const price = parseFloat(row.dataset.priceValue);
        const departureTime = parseFloat(row.dataset.departureTime);
        const arrivalTime = parseFloat(row.dataset.arrivalTime);

        const hasMatchingPrice = !maxPrice || price <= maxPrice;
        const hasMatchingDeparture = checkTimeRange('departure-range:', departureTime, filterTags);
        const hasMatchingArrival = checkTimeRange('arrival-range:', arrivalTime, filterTags);

        if (hasMatchingPrice && hasMatchingDeparture && hasMatchingArrival) {
            row.style.display = '';
            const routeSegments = routeCell.textContent.split(' > ');
            for (let i = 0; i < routeSegments.length - 1; i++) {
                visibleRouteIds.add(`${routeSegments[i]}-${routeSegments[i + 1]}`);
            }
        } else {
            row.style.display = 'none';
        }
    });
    updateLineVisibility(visibleRouteIds, maxPrice);
}

function updateLineVisibility(visibleRouteIds, maxPrice) {
    Object.keys(pathDrawing.routePathCache).forEach(routeId => {
        const lineSet = pathDrawing.routePathCache[routeId];
        if (!lineSet) return;
        lineSet.forEach(line => {
            if (!(line instanceof Line)) return;
            let price;
            for (let tag of line.tags) {
                if (tag.startsWith('price:')) {
                    price = parseFloat(tag.split(':')[1]);
                    break;
                }
            }
            const isVisible = visibleRouteIds.has(line.routeId) && (!maxPrice || (price && price <= maxPrice));
            if (isVisible) {
                line.visibleLine.setStyle({ opacity: 1 });
                map.addLayer(line.visibleLine);
                map.addLayer(line.invisibleLine);
            } else {
                line.visibleLine.setStyle({ opacity: 0 });
                map.removeLayer(line.visibleLine);
                map.removeLayer(line.invisibleLine);
            }
        });
    });
}

function updateFilterHeaders() {
    const filterTypes = ['price', 'departure', 'arrival'];
    filterTypes.forEach(type => {
        const filterIcon = document.getElementById(`${type}Filter`);
        if (!filterIcon) return;
        const filterValue = appState.filterState[type];
        const filterTextElement = document.getElementById(`${type}Text`);
        if (!filterTextElement) return;
        if (!filterValue) {
            filterTextElement.textContent = `${type.charAt(0).toUpperCase()}${type.slice(1)}`;
        } else if (type === 'price') {
            filterTextElement.textContent = filterValue.value ? `$${filterValue.value}` : 'Price';
        } else {
            filterTextElement.textContent = `${formatTime(filterValue.start)} - ${formatTime(filterValue.end)}`;
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
    if (!filterIcon) return;
    const resetIcon = document.getElementById(`reset${column.charAt(0).toUpperCase() + column.slice(1)}Filter`);
    if (!resetIcon) return;

    let filterButtonSpan = filterIcon.closest('.headerText') || filterIcon.closest('.filterButton');
    if (!filterButtonSpan) return;

    const filterValue = appState.filterState[column];
    const isNonDefault = filterValue &&
        ((column === 'price' && filterValue.value !== undefined) ||
         ((column === 'departure' || column === 'arrival') && (filterValue.start !== 0 || filterValue.end !== 24)));

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
        const filterButtonSpan = filterIcon?.closest('.filterButton');
        const resetIcon = e.target;

        if (column === 'departure' || column === 'arrival') {
            appState.filterState[column] = { start: 0, end: 24 };
        } else if (column === 'price') {
            appState.filterState[column] = { value: null };
        }

        if (filterIcon) filterIcon.style.display = 'inline';
        resetIcon.style.display = 'none';
        if (filterButtonSpan) {
            filterButtonSpan.classList.remove('filterButton');
            filterButtonSpan.classList.add('headerText');
        }

        applyFilters();
        updateFilterHeaders();
    }
});

export { applyFilters, toggleFilterResetIcon, updateFilterHeaders, constructFilterTags };
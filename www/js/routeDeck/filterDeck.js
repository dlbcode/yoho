import { appState } from '../stateManager.js';
import { Line } from '../pathDrawing.js';
import { map } from '../map.js';
import { lineManager } from '../lineManager.js';

const DEFAULT_FILTER_STATE = {
    departure: { start: 0, end: 24 },
    arrival: { start: 0, end: 24 },
    price: { value: null }
};

function initializeFilterState() {
    appState.filterState = { ...DEFAULT_FILTER_STATE };
}

function updateFilterState(filterType, values) {
    if (!appState.filterState) {
        initializeFilterState();
    }
    
    appState.filterState[filterType] = { ...values };
    appState.filterStates[appState.currentRouteIndex] = { ...appState.filterState };
    
    applyFilters();
    updateFilterHeaders();
    toggleFilterResetIcon(filterType);
}

function resetFilter(filterType) {
    updateFilterState(filterType, DEFAULT_FILTER_STATE[filterType]);
}

function addTimeFilterTags(filterType, filterTags) {
    const time = appState.filterState[filterType];
    if (!time) return;
    const { start, end } = time;
    if (start < 6 && end > 0) filterTags.push(`${filterType}-range:00-06`);
    if (start < 12 && end > 6) filterTags.push(`${filterType}-range:06-12`);
    if (start < 18 && end > 12) filterTags.push(`${filterType}-range:12-18`);
    if (end > 18) filterTags.push(`${filterType}-range:18-24`);
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
    const cards = document.querySelectorAll('.route-card');
    const filterTags = constructFilterTags();
    const visibleRouteIds = new Set();
    const maxPrice = appState.filterState.price?.value;

    cards.forEach(card => {
        const price = parseFloat(card.dataset.priceValue);
        const departureTime = parseFloat(card.dataset.departureTime);
        const arrivalTime = parseFloat(card.dataset.arrivalTime);

        const hasMatchingPrice = !maxPrice || price <= maxPrice;
        const hasMatchingDeparture = checkTimeRange('departure-range:', departureTime, filterTags);
        const hasMatchingArrival = checkTimeRange('arrival-range:', arrivalTime, filterTags);

        if (hasMatchingPrice && hasMatchingDeparture && hasMatchingArrival) {
            card.style.display = '';
            const routeId = card.getAttribute('data-route-id');
            if (routeId) {
                const segments = createRouteId(routeId).split('-');
                for (let i = 0; i < segments.length - 1; i++) {
                    visibleRouteIds.add(createRouteId([segments[i], segments[i + 1]]));
                }
            }
        } else {
            card.style.display = 'none';
        }
    });

    updateLineVisibility(visibleRouteIds, maxPrice);
}

function updateLineVisibility(visibleRouteIds, maxPrice) {
    // First get all deck-specific lines
    const deckLines = lineManager.getLinesByTags(['type:deck']);
    
    deckLines.forEach(line => {
        if (!line || !(line instanceof Line)) return;
        
        // Skip permanent route lines
        if (line.tags.has('isPermanent')) return;

        let price;
        for (let tag of line.tags) {
            if (tag.startsWith('price:')) {
                price = parseFloat(tag.split(':')[1]);
                break;
            }
        }

        const isVisible = visibleRouteIds.has(line.routeId) && 
                         (!maxPrice || (price && price <= maxPrice));

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
}

function updateFilterHeaders() {
    const filterTypes = ['price', 'departure', 'arrival'];
    filterTypes.forEach(filterType => {
        const filterIcon = document.getElementById(`${filterType}Filter`);
        if (!filterIcon) return;
        const filterValue = appState.filterState[filterType];
        const filterTextElement = document.getElementById(`${filterType}Text`);
        if (!filterTextElement) return;
        if (!filterValue) {
            filterTextElement.textContent = `${filterType.charAt(0).toUpperCase()}${filterType.slice(1)}`;
        } else if (filterType === 'price') {
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

function toggleFilterResetIcon(filterType) {
    const filterIcon = document.getElementById(`${filterType}Filter`);
    const resetIcon = document.getElementById(`reset${filterType.charAt(0).toUpperCase() + filterType.slice(1)}Filter`);
    const filterButtonSpan = filterIcon?.closest('.filter-header, .filterButton');

    if (!filterIcon || !resetIcon || !filterButtonSpan) return;

    const filterValue = appState.filterState[filterType];
    const isNonDefault = filterValue && 
        JSON.stringify(filterValue) !== JSON.stringify(DEFAULT_FILTER_STATE[filterType]);

    resetIcon.classList.toggle('hidden', !isNonDefault);
    filterIcon.classList.toggle('hidden', isNonDefault);
    filterButtonSpan.classList.toggle('filterButton', isNonDefault);
    filterButtonSpan.classList.toggle('filter-header', !isNonDefault);
}

// Consolidate reset logic and improve conciseness
document.addEventListener('click', function (e) {
    if (e.target.classList.contains('resetIcon')) {
        const filterType = e.target.getAttribute('data-filter'); // Changed attribute name
        resetFilter(filterType);
    }
});

export function createRouteId(segments, separator = '-') {
    if (Array.isArray(segments)) {
        if (segments[0]?.flyFrom) {
            // Handle route segment objects
            return segments
                .map(segment => segment.flyFrom)
                .concat(segments[segments.length - 1].flyTo)
                .join(separator);
        }
        // Handle array of IATA codes
        return segments.join(separator);
    }
    // Handle string input
    return segments.split(/[-|]/).join(separator);
}

export { 
    applyFilters, 
    toggleFilterResetIcon, 
    updateFilterHeaders, 
    constructFilterTags,
    initializeFilterState,
    updateFilterState 
};
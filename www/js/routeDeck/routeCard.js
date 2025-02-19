import { createRouteId } from './filterDeck.js';
import { highlightRouteLines, resetRouteLines } from './routeHighlighting.js';

export function formatFlightDateTime(date) {
    const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
    return `${dayName} ${date.toLocaleString()}`;
}

function formatTime(date) {
    return date.toLocaleTimeString([], { 
        hour: 'numeric',  // changed from '2-digit' to 'numeric'
        minute: '2-digit'
    });
}

const priceRangeCache = new Map();

function getPriceRangeCategory(price) {
    if (priceRangeCache.has(price)) {
        return priceRangeCache.get(price);
    }

    const ranges = [
        { max: 100, label: '0-100' },
        { max: 200, label: '100-200' },
        { max: 300, label: '200-300' },
        { max: 400, label: '300-400' },
        { max: 500, label: '400-500' }
    ];
    
    const range = ranges.find(r => price < r.max);
    const result = `price-range:${range ? range.label : '500+'}`;
    priceRangeCache.set(price, result);
    return result;
}

function createRouteCard(flight, endpoint, routeIndex, destination) {
    const card = document.createElement('div');
    card.className = 'route-card';
    
    // Use standardized route ID creation
    const routeId = createRouteId(flight.route);
    card.setAttribute('data-route-id', routeId);
    
    const departureDate = endpoint === 'range' || destination === 'Any' 
        ? new Date(flight.dTime * 1000)
        : new Date(flight.local_departure);
    const arrivalDate = endpoint === 'range' || destination === 'Any'
        ? new Date(flight.aTime * 1000)
        : new Date(flight.local_arrival);

    const cardId = `deck-${routeIndex}-${flight.id}`;
    
    card.setAttribute('data-card-id', cardId);
    card.setAttribute('data-price', flight.price);
    card.setAttribute('data-departure-time', departureDate.getHours() + departureDate.getMinutes() / 60);
    card.setAttribute('data-arrival-time', arrivalDate.getHours() + arrivalDate.getMinutes() / 60);
    card.setAttribute('data-price-range', getPriceRangeCategory(flight.price));
    card.setAttribute('data-price-value', Math.round(flight.price));

    card.innerHTML = `
        <div class="card-content">
            <img src="assets/airline_logos/70px/${flight.route[0].airline}.png" 
                 alt="${flight.route[0].airline} Logo" 
                 class="airline-logo">
            
            <div class="time-group departure">
                <span class="time">${formatTime(departureDate)}</span>
                <span class="iata">${flight.route[0].flyFrom}</span>
            </div>

            <span class="route-arrow">→</span>

            <div class="time-group arrival">
                <span class="time">${formatTime(arrivalDate)}</span>
                <span class="iata">${flight.route[flight.route.length - 1].flyTo}</span>
            </div>

            <div class="stops-info">
                ${flight.route.length > 1 
                  ? `${flight.route.length - 1} stop${flight.route.length > 2 ? 's' : ''}`
                  : 'Direct'}
            </div>

            <div class="route-stops">
                ${flight.route.slice(1, -1).map(segment => 
                    `<span class="stop-iata">${segment.flyTo}</span>`
                ).join(' · ')}
            </div>

            <div class="duration">
                ${Math.floor(flight.duration.total / 3600)}h ${Math.floor((flight.duration.total % 3600) / 60)}m
            </div>

            <div class="card-price">$${flight.price.toFixed(2)}</div>
        </div>
    `;

    card.addEventListener('mouseover', () => highlightRouteLines(flight, card));
    card.addEventListener('mouseout', () => resetRouteLines(card));

    return card;
}

export { createRouteCard };
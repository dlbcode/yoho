import { createRouteId } from './filterDeck.js';
import { highlightRouteLines, resetRouteLines } from './routeHighlighting.js';

function formatFlightDateTime(date) {
    const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
    return `${dayName} ${date.toLocaleString()}`;
}

function getPriceRangeCategory(price) {
    const ranges = [
        { max: 100, label: '0-100' },
        { max: 200, label: '100-200' },
        { max: 300, label: '200-300' },
        { max: 400, label: '300-400' },
        { max: 500, label: '400-500' }
    ];
    
    const range = ranges.find(r => price < r.max);
    return `price-range:${range ? range.label : '500+'}`;
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
        <div class="card-header">
            <div class="card-price">$${flight.price.toFixed(2)}</div>
            <div class="card-duration">
                <span class="detail-label">Duration</span>
                <span class="detail-value">${Math.floor(flight.duration.total / 3600)}h ${Math.floor((flight.duration.total % 3600) / 60)}m</span>
            </div>
        </div>
        
        <div class="card-route">
            ${flight.route.map((segment, idx) => `
                <div class="route-segment">
                    <div class="detail-group">
                        <div class="detail-label">${idx === 0 ? 'From' : 'Via'}</div>
                        <div class="detail-value">${segment.flyFrom}</div>
                    </div>
                    ${idx < flight.route.length - 1 ? '<span class="route-arrow">→</span>' : ''}
                </div>
            `).join('')}
            <div class="route-segment">
                <div class="detail-group">
                    <div class="detail-label">To</div>
                    <div class="detail-value">${flight.route[flight.route.length - 1].flyTo}</div>
                </div>
            </div>
        </div>

        <div class="card-details">
            <div class="detail-group">
                <div class="detail-label">Departure</div>
                <div class="detail-value" data-departure="${formatFlightDateTime(departureDate)}">${formatFlightDateTime(departureDate)}</div>
            </div>
            <div class="detail-group">
                <div class="detail-label">Arrival</div>
                <div class="detail-value" data-arrival="${formatFlightDateTime(arrivalDate)}">${formatFlightDateTime(arrivalDate)}</div>
            </div>
            <div class="detail-group">
                <div class="detail-label">Airlines</div>
                <div class="detail-value">${flight.airlines.join(", ")}</div>
            </div>
            <div class="detail-group">
                <div class="detail-label">Stops</div>
                <div class="detail-value">${flight.route.length - 1}</div>
            </div>
        </div>
    `;

    card.addEventListener('mouseover', () => highlightRouteLines(flight, card));
    card.addEventListener('mouseout', () => resetRouteLines(card));

    return card;
}

export { createRouteCard };
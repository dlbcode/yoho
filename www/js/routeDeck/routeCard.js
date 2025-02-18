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
            <div class="card-route">
                ${flight.route.map((segment, idx, segments) => {
                    const airlineLogoUrl = `assets/airline_logos/70px/${segment.airline}.png`;
                    const isLastSegment = idx === segments.length - 1;
                    const segmentDate = new Date(segment.local_departure);
                    
                    // Calculate layover time if this isn't the first segment
                    const layoverInfo = idx > 0 ? (() => {
                        const prevSegment = segments[idx - 1];
                        const arrivalTime = new Date(prevSegment.local_arrival);
                        const departureTime = new Date(segment.local_departure);
                        const layoverMins = Math.round((departureTime - arrivalTime) / (1000 * 60));
                        const hours = Math.floor(layoverMins / 60);
                        const mins = layoverMins % 60;
                        return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
                    })() : '';
                    
                    return `
                        <div class="route-segment">
                            ${idx > 0 ? `
                                <div class="segment-info">
                                    <div class="card-times layover" title="Arrives: ${formatTime(new Date(segments[idx-1].local_arrival))}">
                                        <span>${layoverInfo}</span>
                                    </div>
                                    <span class="segment-iata">${segment.flyFrom}</span>
                                </div>
                            ` : `
                                <div class="segment-info">
                                    <div class="card-times">
                                        <span>${formatTime(departureDate)}</span>
                                    </div>
                                    <span class="segment-iata">${segment.flyFrom}</span>
                                </div>
                            `}
                            <div style="display: flex; flex-direction: column; align-items: center;">
                                <span class="route-arrow">→</span>
                                <img src="${airlineLogoUrl}" alt="${segment.airline} Logo" style="width: 20px; height: 20px;">
                            </div>
                            ${isLastSegment ? `
                                <div class="detail-group">
                                    <div class="segment-info">
                                        <div class="card-times arrive">
                                            <span>${formatTime(arrivalDate)}</span>
                                        </div>
                                        <span class="segment-iata">${segment.flyTo}</span>
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                    `;
                }).join('')}
            </div>
            <div class="total-duration">
                <span class="duration-text">Total Duration:</span>
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
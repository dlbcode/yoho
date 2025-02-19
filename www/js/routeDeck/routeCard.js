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

function setCardAttributes(card, attributes) {
    for (const [key, value] of Object.entries(attributes)) {
        card.setAttribute(key, value);
    }
}

function createRouteArrowSVG(stops, segments) {
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.classList.add("route-arrow-svg");
    svg.setAttribute("viewBox", "0 0 110 40"); // Increase height to accommodate IATAs

    const line = document.createElementNS(svgNS, "line");
    line.classList.add("route-arrow-line");
    line.setAttribute("x1", "0");
    line.setAttribute("y1", "12");
    line.setAttribute("x2", "100");
    line.setAttribute("y2", "12");
    svg.appendChild(line);

    const dotSpacing = 100 / (stops + 1);
    for (let i = 1; i <= stops; i++) {
        const dot = document.createElementNS(svgNS, "circle");
        dot.classList.add("route-arrow-dot");
        dot.setAttribute("cx", dotSpacing * i);
        dot.setAttribute("cy", "12");
        dot.setAttribute("r", "4"); // Increase the radius of the dots
        svg.appendChild(dot);

        const iata = document.createElementNS(svgNS, "text");
        iata.classList.add("route-arrow-iata");
        iata.setAttribute("x", dotSpacing * i);
        iata.setAttribute("y", "25"); // Position below the dot
        iata.textContent = segments[i - 1].flyTo;
        svg.appendChild(iata);
    }

    const arrowHead = document.createElementNS(svgNS, "polygon");
    arrowHead.classList.add("route-arrow-head");
    arrowHead.setAttribute("points", "100,8 108,12 100,16");
    svg.appendChild(arrowHead);

    return svg;
}

function createRouteCard(flight, endpoint, routeIndex, destination) {
    const card = document.createElement('div');
    card.className = 'route-card';
    
    const routeId = createRouteId(flight.route);
    card.setAttribute('data-route-id', routeId);
    
    const departureDate = endpoint === 'range' || destination === 'Any' 
        ? new Date(flight.dTime * 1000)
        : new Date(flight.local_departure);
    const arrivalDate = endpoint === 'range' || destination === 'Any'
        ? new Date(flight.aTime * 1000)
        : new Date(flight.local_arrival);

    const cardId = `deck-${routeIndex}-${flight.id}`;
    
    // Set card attributes
    setCardAttributes(card, {
        'data-card-id': cardId,
        'data-price': flight.price,
        'data-departure-time': departureDate.getHours() + departureDate.getMinutes() / 60,
        'data-arrival-time': arrivalDate.getHours() + arrivalDate.getMinutes() / 60,
        'data-price-range': getPriceRangeCategory(flight.price),
        'data-price-value': Math.round(flight.price)
    });

    card.innerHTML = `
        <div class="card-content">
            <div class="airline-section">
                <img src="assets/airline_logos/70px/${flight.route[0].airline}.png" 
                     alt="${flight.route[0].airline} Logo" 
                     class="airline-logo">
            </div>

            <div class="journey-section">
                <div class="departure-section">
                    <span class="departure-time">${formatTime(departureDate)}</span>
                    <span class="departure-code">${flight.route[0].flyFrom}</span>
                </div>

                <div class="route-indicator">
                    <div class="duration">
                        ${Math.floor(flight.duration.total / 3600)}h ${Math.floor((flight.duration.total % 3600) / 60)}m
                    </div>
                    ${createRouteArrowSVG(flight.route.length - 1, flight.route).outerHTML}
                </div>

                <div class="arrival-section">
                    <span class="arrival-time">${formatTime(arrivalDate)}</span>
                    <span class="arrival-code">${flight.route[flight.route.length - 1].flyTo}</span>
                </div>
            </div>

            <div class="price-section">
                <div class="card-price">$${flight.price.toFixed(2)}</div>
            </div>
        </div>
    `;

    card.addEventListener('mouseover', () => highlightRouteLines(flight, card));
    card.addEventListener('mouseout', () => resetRouteLines(card));

    return card;
}

export { createRouteCard };
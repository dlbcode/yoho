import { createRouteId } from './deckFilter.js';
import { highlightRouteLines, resetRouteLines } from './routeHighlighting.js';
import { appState } from '../stateManager.js';
import { airlineLogoManager } from '../utils/airlineLogoManager.js';

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

function createRouteArrowSVG(stops, segments, isReturn = false) {
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.classList.add("route-arrow-svg");
    svg.setAttribute("viewBox", "0 0 110 40"); // Increase height to accommodate IATAs

    const line = document.createElementNS(svgNS, "line");
    line.classList.add("route-arrow-line");
    
    if (isReturn) {
        // For return trips, flip the direction (right to left)
        line.setAttribute("x1", "100");
        line.setAttribute("y1", "12");
        line.setAttribute("x2", "0");
        line.setAttribute("y2", "12");
    } else {
        // For outbound trips (left to right)
        line.setAttribute("x1", "0");
        line.setAttribute("y1", "12");
        line.setAttribute("x2", "100");
        line.setAttribute("y2", "12");
    }
    
    svg.appendChild(line);

    const dotSpacing = 100 / (stops + 1);
    for (let i = 1; i <= stops; i++) {
        const dot = document.createElementNS(svgNS, "circle");
        dot.classList.add("route-arrow-dot");
        
        // Position dots based on direction
        const position = isReturn ? 100 - (dotSpacing * i) : dotSpacing * i;
        
        dot.setAttribute("cx", position);
        dot.setAttribute("cy", "12");
        dot.setAttribute("r", "4");
        svg.appendChild(dot);

        const iata = document.createElementNS(svgNS, "text");
        iata.classList.add("route-arrow-iata");
        iata.setAttribute("x", position);
        iata.setAttribute("y", "25"); // Position below the dot
        
        // For return trips, the IATA codes need to be reversed
        const segmentIndex = isReturn ? stops - i : i - 1;
        iata.textContent = segments[segmentIndex].flyTo;
        
        svg.appendChild(iata);
    }

    const arrowHead = document.createElementNS(svgNS, "polygon");
    arrowHead.classList.add("route-arrow-head");
    
    if (isReturn) {
        // Arrow pointing left for return trips
        arrowHead.setAttribute("points", "0,12 8,8 8,16");
    } else {
        // Arrow pointing right for outbound trips
        arrowHead.setAttribute("points", "100,8 108,12 100,16");
    }
    
    svg.appendChild(arrowHead);

    return svg;
}

function createRouteCard(flight, endpoint, routeIndex, destination) {
    const card = document.createElement('div');
    card.className = 'route-card';
    card.dataset.priceValue = flight.price;
    
    const routeId = createRouteId(flight.route);
    card.setAttribute('data-route-id', routeId);
    
    // Get trip type from appState
    const tripType = appState.routes[routeIndex]?.tripType || 'oneWay';
    
    // Determine if this is a round trip
    const isRoundTrip = tripType === 'roundTrip';
    
    // Extract outbound and return segments for round trips
    let outboundSegments, returnSegments;
    let departureDate, arrivalDate, returnDepartureDate, returnArrivalDate;
    
    if (isRoundTrip && flight.route && flight.route.length > 1) {
        // Find where the return journey starts by looking for the 'return' flag in route segments
        const returnStartIndex = flight.route.findIndex(segment => segment.return === 1);
        
        if (returnStartIndex !== -1) {
            // Split into outbound and return segments based on the return flag
            outboundSegments = flight.route.slice(0, returnStartIndex);
            returnSegments = flight.route.slice(returnStartIndex);
            
            // Set dates for both segments
            departureDate = new Date(outboundSegments[0].local_departure || outboundSegments[0].dTime * 1000);
            arrivalDate = new Date(outboundSegments[outboundSegments.length - 1].local_arrival || 
                                outboundSegments[outboundSegments.length - 1].aTime * 1000);
            
            returnDepartureDate = new Date(returnSegments[0].local_departure || returnSegments[0].dTime * 1000);
            returnArrivalDate = new Date(returnSegments[returnSegments.length - 1].local_arrival || 
                                    returnSegments[returnSegments.length - 1].aTime * 1000);
        } else {
            // Fallback: try to identify by looking for a segment that returns to origin
            const originIata = flight.route[0].flyFrom;
            const turningPointIndex = flight.route.findIndex((segment, idx) => 
                idx > 0 && segment.flyTo === originIata);
                
            if (turningPointIndex !== -1) {
                // Split into outbound and return segments
                outboundSegments = flight.route.slice(0, turningPointIndex);
                returnSegments = flight.route.slice(turningPointIndex);
                
                // Set dates for both segments
                departureDate = new Date(outboundSegments[0].local_departure || outboundSegments[0].dTime * 1000);
                arrivalDate = new Date(outboundSegments[outboundSegments.length - 1].local_arrival || 
                                    outboundSegments[outboundSegments.length - 1].aTime * 1000);
                
                returnDepartureDate = new Date(returnSegments[0].local_departure || returnSegments[0].dTime * 1000);
                returnArrivalDate = new Date(returnSegments[returnSegments.length - 1].local_arrival || 
                                        returnSegments[returnSegments.length - 1].aTime * 1000);
            } else {
                // Handle as one-way if no turning point found
                departureDate = new Date(flight.local_departure || flight.dTime * 1000);
                arrivalDate = new Date(flight.local_arrival || flight.aTime * 1000);
                outboundSegments = flight.route; // Treat all segments as outbound
                returnSegments = null;
            }
        }
    } else {
        // Handle one-way trips
        departureDate = new Date(flight.local_departure || flight.dTime * 1000);
        arrivalDate = new Date(flight.local_arrival || flight.aTime * 1000);
        outboundSegments = flight.route; // Treat all segments as outbound
        returnSegments = null;
    }

    // Calculate stops for each segment
    const numberOfOutboundStops = outboundSegments ? outboundSegments.length - 1 : flight.route.length - 1;
    const numberOfReturnStops = returnSegments ? returnSegments.length - 1 : 0;
    const totalStops = numberOfOutboundStops + numberOfReturnStops;

    // Set card attributes
    setCardAttributes(card, {
        'data-card-id': `deck-${routeIndex}-${flight.id}`,
        'data-price': flight.price,
        'data-departure-time': departureDate.getHours() + departureDate.getMinutes() / 60,
        'data-arrival-time': arrivalDate.getHours() + arrivalDate.getMinutes() / 60,
        'data-price-range': getPriceRangeCategory(flight.price),
        'data-price-value': Math.round(flight.price),
        'data-stops': totalStops,
        'data-trip-type': tripType
    });
    
    // Format dates
    const formatDateShort = (date) => {
        return date.toLocaleDateString('en-US', { 
            weekday: 'short', 
            month: 'short', 
            day: 'numeric' 
        });
    };
    
    const departDateFormatted = formatDateShort(departureDate);
    const arrivalDateFormatted = formatDateShort(arrivalDate);
    
    // Format return dates only if they exist
    const returnDepartDateFormatted = returnDepartureDate ? formatDateShort(returnDepartureDate) : null;
    const returnArrivalDateFormatted = returnArrivalDate ? formatDateShort(returnArrivalDate) : null;
    
    // Instead of hardcoding the logo URL, we'll use our logo manager
    const airlineCode = flight.route[0].airline;
    
    // Create the card content but wait to set the airline logo
    card.innerHTML = generateCardContent(flight, departDateFormatted, arrivalDateFormatted, 
        tripType, isRoundTrip, returnDepartDateFormatted, returnArrivalDateFormatted, 
        numberOfOutboundStops, numberOfReturnStops, outboundSegments, returnSegments, 
        departureDate, arrivalDate, returnDepartureDate, returnArrivalDate);

    // Find the airline logo img and update it once loaded
    const airlineLogoImg = card.querySelector('.airline-logo');
    if (airlineLogoImg) {
        // Set a loading state
        airlineLogoImg.src = 'assets/loading_blocks.gif';
        
        // Fetch the proper logo URL
        airlineLogoManager.getLogoUrl(airlineCode)
            .then(logoUrl => {
                airlineLogoImg.src = logoUrl;
            })
            .catch(error => {
                console.error('Error loading airline logo:', error);
                airlineLogoImg.src = airlineLogoManager.getFallbackLogoUrl();
            });
    }

    // Add event listeners
    card.addEventListener('mouseover', () => highlightRouteLines(flight, card));
    card.addEventListener('mouseout', () => resetRouteLines(card));

    return card;
}

// Helper function to generate the card HTML structure
function generateCardContent(flight, departDateFormatted, arrivalDateFormatted, 
    tripType, isRoundTrip, returnDepartDateFormatted, returnArrivalDateFormatted,
    numberOfOutboundStops, numberOfReturnStops, outboundSegments, returnSegments,
    departureDate, arrivalDate, returnDepartureDate, returnArrivalDate) {

    if (isRoundTrip && returnSegments && returnDepartDateFormatted && returnArrivalDateFormatted) {
        return `
            <div class="card-content round-trip">
                <div class="journey-section">
                    <div class="outbound-journey">
                        <div class="airline-section">
                            <img src="" alt="${flight.route[0].airline} Logo" class="airline-logo">
                        </div>
                        <div class="journey-details">
                            <div class="departure-section">
                                <span class="departure-date">${departDateFormatted}</span>
                                <span class="departure-time">${formatTime(departureDate)}</span>
                                <span class="departure-code">${outboundSegments[0].flyFrom}</span>
                            </div>

                            <div class="route-indicator">
                                <div class="duration">
                                    ${numberOfOutboundStops > 0 ? `${numberOfOutboundStops} stop${numberOfOutboundStops > 1 ? 's' : ''}` : 'Direct'}
                                </div>
                                ${createRouteArrowSVG(numberOfOutboundStops, outboundSegments).outerHTML}
                            </div>

                            <div class="arrival-section">
                                <span class="arrival-date">${arrivalDateFormatted}</span>
                                <span class="arrival-time">${formatTime(arrivalDate)}</span>
                                <span class="arrival-code">${outboundSegments[outboundSegments.length - 1].flyTo}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="return-journey">
                        <div class="airline-section">
                            <img src="" alt="${returnSegments[0].airline} Logo" class="airline-logo">
                        </div>
                        <div class="journey-details">
                            <div class="arrival-section">
                                <span class="arrival-date">${returnArrivalDateFormatted}</span>
                                <span class="arrival-time">${formatTime(returnArrivalDate)}</span>
                                <span class="arrival-code">${returnSegments[returnSegments.length - 1].flyTo}</span>
                            </div>

                            <div class="route-indicator">
                                <div class="duration">
                                    ${numberOfReturnStops > 0 ? `${numberOfReturnStops} stop${numberOfReturnStops > 1 ? 's' : ''}` : 'Direct'}
                                </div>
                                ${createRouteArrowSVG(numberOfReturnStops, returnSegments, true).outerHTML}
                            </div>

                            <div class="departure-section">
                                <span class="departure-date">${returnDepartDateFormatted}</span>
                                <span class="departure-time">${formatTime(returnDepartureDate)}</span>
                                <span class="departure-code">${returnSegments[0].flyFrom}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="price-section">
                    <div class="card-price">$${Math.ceil(flight.price)}</div>
                </div>
            </div>
        `;
    } else {
        // One-way flight display
        return `
            <div class="card-content">
                <div class="journey-section">
                    <div class="airline-section">
                        <img src="" alt="${flight.route[0].airline} Logo" class="airline-logo">
                    </div>
                    <div class="departure-section">
                        <span class="departure-date">${departDateFormatted}</span>
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
                        <span class="arrival-date">${arrivalDateFormatted}</span>
                        <span class="arrival-time">${formatTime(arrivalDate)}</span>
                        <span class="arrival-code">${flight.route[flight.route.length - 1].flyTo}</span>
                    </div>
                </div>

                <div class="price-section">
                    <div class="card-price">$${Math.ceil(flight.price)}</div>
                </div>
            </div>
        `;
    }
}

export { createRouteCard };
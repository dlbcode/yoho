import { routeInfoCard } from './routeInfoCard.js';
import { createRouteId } from './deckFilter.js';
import { pathDrawing, Line } from '../pathDrawing.js';
import { drawFlightLines, handleRouteLineVisibility, fitMapToFlightRoute } from './routeHighlighting.js';

/**
 * Attaches event handlers to route cards
 * @param {HTMLElement} card - The route card element
 * @param {Object} flight - The flight object for this card
 * @param {number} index - Index of the flight in the data array
 * @param {Array} data - Array of all flights data
 * @param {number} routeIndex - Route waypoint index
 */
function attachCardEventHandlers(card, flight, index, data, routeIndex) {
    // Use event delegation for common events
    const handlers = {
        click: () => {
            const routeIdString = card.getAttribute('data-route-id');
            const routeIds = routeIdString.split('|');
            const fullFlightData = data[index];
            
            fitMapToFlightRoute(flight).catch(err => 
                console.error("Error handling map view adjustment:", err)
            );
            
            routeInfoCard(card, fullFlightData, routeIds, routeIndex);
        },
        
        mouseover: () => {
            if (!flight?.route) return;
            
            const routePath = createRouteId(flight.route);
            
            // Use cached flight path when possible instead of recomputing
            const cardId = `deck-${routeIndex}-${flight.id}`;
            const existingRouteLines = Object.values(pathDrawing.routePathCache)
                .flat()
                .filter(l => flight.route.some((segment) => {
                    const segmentPath = `${segment.flyFrom}-${segment.flyTo}`;
                    return l.routeId === segmentPath;
                }));
            
            if (existingRouteLines.length > 0) {
                existingRouteLines.forEach(line => {
                    if (line instanceof Line) {
                        line.routeData = {
                            ...line.routeData,
                            cardId: cardId
                        };
                        line.highlight();
                    }
                });
            } else {
                drawFlightLines(flight, routeIndex, true);
            }
        },
        
        mouseout: () => {
            handleRouteLineVisibility(flight, routeIndex, false);
        }
    };

    // Add all event listeners at once
    Object.entries(handlers).forEach(([event, handler]) => {
        card.addEventListener(event, handler);
    });
    
    // Store handlers on element for potential cleanup later
    card._handlers = handlers;
}

export { attachCardEventHandlers };

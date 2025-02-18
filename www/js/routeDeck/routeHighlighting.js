import { pathDrawing, Line } from '../pathDrawing.js';
import { lineManager } from '../lineManager.js';

export function highlightRouteLines(flightData, cardElement) {
    if (!flightData?.route) return;
    
    const existingRouteLines = Object.values(pathDrawing.routePathCache)
        .flat()
        .filter(l => flightData.route.some((segment) => {
            const segmentPath = `${segment.flyFrom}-${segment.flyTo}`;
            return l.routeId === segmentPath;
        }));
    
    if (existingRouteLines.length > 0) {
        existingRouteLines.forEach(line => {
            if (line instanceof Line) {
                line.routeData = {
                    ...line.routeData,
                    cardId: cardElement.getAttribute('data-card-id')
                };
                line.highlight();
            }
        });
    }
}

export function resetRouteLines(cardElement) {
    const cardId = cardElement.getAttribute('data-card-id');
    if (cardId) {
        const routeLines = Object.values(pathDrawing.routePathCache)
            .flat()
            .filter(l => l.routeData?.cardId === cardId);
            
        routeLines.forEach(routeLine => {
            routeLine instanceof Line && routeLine.reset();
        });
    }
    lineManager.clearLines('hover');
}
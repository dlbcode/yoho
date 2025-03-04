import { pathDrawing, Line } from '../pathDrawing.js';
import { lineManager } from '../lineManager.js';
import { createRouteId } from './deckFilter.js';
import { map } from '../map.js';
import { flightMap } from '../flightMap.js';
import { appState } from '../stateManager.js';

// -------------------- Route Line Management Functions --------------------

// Replace multiple occurrences of line styling with a single helper function
function applyLineHighlightStyle(line) {
    if (line instanceof Line && line.visibleLine) {
        line.visibleLine.setStyle({ color: 'white', weight: 2, opacity: 1 });
        line.visibleLine.setZIndexOffset(1000);
        line.visibleLine.bringToFront();
    }
}

// Replace repeated route path creation with a helper function
function createRouteData(flight, segment, nextSegment, cardId) {
    return {
        cardId,
        segmentInfo: {
            originAirport: segment,
            destinationAirport: nextSegment,
            date: segment.local_departure
        },
        routeInfo: {
            originAirport: flight.route[0],
            destinationAirport: flight.route[flight.route.length - 1],
            price: flight.price,
            date: flight.route[0].local_departure,
            fullRoute: flight.route,
            deep_link: flight.deep_link,
            bags_price: flight.bags_price,
            duration: flight.duration
        }
    };
}

/**
 * Draws flight route lines on the map
 * @param {Object} flight - Flight object containing route information
 * @param {number} routeIndex - Route index for identification
 * @param {boolean} isTemporary - Whether these lines are temporary (e.g., for hover effects)
 * @returns {Array} Array of drawn line objects
 */
export function drawFlightLines(flight, routeIndex, isTemporary = false) {
    // Skip if no route data is available
    if (!flight?.route || flight.route.length === 0) {
        console.warn('No route data available for flight');
        return [];
    }

    // Cache route path calculations to reduce redundant operations
    const pathCache = {};
    const cardId = `deck-${routeIndex}-${flight.id}`;
    const drawnLines = [];

    flight.route.forEach((segment, idx) => {
        // Create next segment or use the current one with reversed directions
        // for the last segment in the route
        const nextSegment = flight.route[idx + 1] || {
            ...segment,
            flyFrom: segment.flyTo,
            local_departure: segment.local_arrival
        };

        const routeId = createRouteId([{flyFrom: segment.flyFrom, flyTo: segment.flyTo}]);
        
        // Check cache to avoid redundant calculations for the same route segment
        if (!pathCache[routeId]) {
            const routeData = createRouteData(flight, segment, nextSegment, cardId);

            const line = pathDrawing.drawLine(routeId, 'route', {
                price: flight.price,
                iata: segment.flyFrom,
                isDeckRoute: true,
                isTemporary,
                type: 'deck', // Add for consistent tagging
                routeData
            });

            if (line) {
                drawnLines.push(line);
                if (isTemporary) {
                    applyLineHighlightStyle(line);
                }
                pathCache[routeId] = true;
            }
        }
    });

    return drawnLines;
}

/**
 * Manages visibility of route lines for a specific flight
 * @param {Object} flight - Flight object containing route information
 * @param {number} routeIndex - Route index
 * @param {boolean} isVisible - Whether lines should be visible
 */
export function handleRouteLineVisibility(flight, routeIndex, isVisible) {
    if (!flight?.route) return;
    
    const cardId = `deck-${routeIndex}-${flight.id}`;
    const routeLines = Object.values(pathDrawing.routePathCache)
        .flat()
        .filter(l => l.routeData?.cardId === cardId);
        
    routeLines.forEach(line => {
        if (line instanceof Line) {
            if (line.tags.has('isTemporary')) {
                // Always remove temporary lines
                line.remove();
                // Remove from cache
                const routeId = line.routeId;
                pathDrawing.routePathCache[routeId] = 
                    pathDrawing.routePathCache[routeId].filter(l => l !== line);
            } else {
                isVisible ? line.highlight() : line.reset();
            }
        }
    });
}

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

// -------------------- Map View Management Functions --------------------

/**
 * Fits the map view to encompass all stops in a flight route
 * @param {Object} flight - The flight object containing route information
 * @returns {Promise<void>}
 */
export async function fitMapToFlightRoute(flight) {
    // Skip unnecessary processing early
    if (appState.preventMapViewChange || !flight.route || flight.route.length === 0) {
        return;
    }
    
    try {
        // Use Set for unique IATA codes more efficiently
        const iataSet = new Set(
            flight.route.flatMap(segment => [segment.flyFrom, segment.flyTo].filter(Boolean))
        );
        
        const iataList = [...iataSet];
        if (iataList.length === 0) return;
        
        // Get airport data in parallel with Promise.all
        const validAirports = (await Promise.all(
            iataList.map(iata => flightMap.getAirportDataByIata(iata))
        )).filter(airport => airport && airport.latitude && airport.longitude);
        
        if (validAirports.length === 0) return;
        
        // Use array methods instead of loops where possible
        const latitudes = validAirports.map(airport => airport.latitude);
        const longitudes = validAirports.map(airport => airport.longitude);
        
        const minLat = Math.min(...latitudes);
        const maxLat = Math.max(...latitudes);
        const minLong = Math.min(...longitudes);
        const maxLong = Math.max(...longitudes);
        
        const spansDegrees = maxLong - minLong;
        const crossesAntimeridian = spansDegrees > 180;
        
        if (crossesAntimeridian) {
            // Special handling for routes crossing the antimeridian (180° longitude)
            const adjustedLongitudes = longitudes.map(lon => lon < 0 ? lon + 360 : lon);
            const adjustedMinLong = Math.min(...adjustedLongitudes);
            const adjustedMaxLong = Math.max(...adjustedLongitudes);
            
            // Center around the middle of the adjusted longitudes
            const centerLong = ((adjustedMinLong + adjustedMaxLong) / 2) % 360;
            const centerLat = (minLat + maxLat) / 2;
            
            // Fit the map to the bounds
            map.fitBounds([
                [minLat, centerLong - 180],
                [maxLat, centerLong + 180]
            ]);
        } else {
            // Normal case - create bounds and fit map
            map.fitBounds([
                [minLat, minLong],
                [maxLat, maxLong]
            ]);
        }
    } catch (error) {
        console.error("Error fitting map to flight route:", error);
    }
}
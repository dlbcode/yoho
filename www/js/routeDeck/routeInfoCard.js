import { appState, updateState } from '../stateManager.js';
import { pathDrawing } from '../pathDrawing.js';
import { flightMap } from '../flightMap.js';
import { map } from '../map.js';
import { lineManager } from '../lineManager.js';
import { constructFilterTags, createRouteId } from './deckFilter.js';
import { highlightRouteLines, resetRouteLines } from './routeHighlighting.js';
import { formatFlightDateTime } from './routeCard.js';
import { airlineLogoManager } from '../utils/airlineLogoManager.js';
import { 
    isDaytime, 
    calculateTransitions, 
    createDayNightBar, 
    createLayoverBar 
} from './dayNightBar.js';
import { calculateFlightDuration, calculateDurationHours } from '../utils/durationCalc.js';

const formatTime = (date) => date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
// Replace inline SVG with reference to external file
const bagIcon = `<img src="assets/baggage-icon.svg" alt="Baggage" height="20" width="20">`;

async function generateSegmentDetails(flight) {
    let segmentsHtml = '';
    
    // Find where the return journey starts, if this is a round-trip flight
    const returnStartIndex = flight.route.findIndex(segment => segment.return === 1);
    const hasReturnSegments = returnStartIndex !== -1;
    
    // If this is a round trip, calculate the days at destination and get destination name
    let daysAtDestination = '';
    let destinationCity = '';
    
    if (hasReturnSegments && returnStartIndex > 0) {
        // Last outbound segment arrival
        const arrivalAtDestination = flight.route[returnStartIndex - 1].local_arrival 
            ? new Date(flight.route[returnStartIndex - 1].local_arrival) 
            : new Date(flight.route[returnStartIndex - 1].aTime * 1000);
            
        // First return segment departure
        const departureFromDestination = flight.route[returnStartIndex].local_departure 
            ? new Date(flight.route[returnStartIndex].local_departure) 
            : new Date(flight.route[returnStartIndex].dTime * 1000);
            
        // Calculate days difference (accounting for partial days)
        const msPerDay = 1000 * 60 * 60 * 24;
        const daysDiff = Math.round((departureFromDestination - arrivalAtDestination) / msPerDay);
        
        // Get destination city name (from cityTo of the last outbound segment)
        destinationCity = flight.route[returnStartIndex - 1].cityTo || 
                         flight.route[returnStartIndex - 1].flyTo;
                         
        daysAtDestination = `${daysDiff} day${daysDiff !== 1 ? 's' : ''} in ${destinationCity}`;
    }
    
    for (let idx = 0; idx < flight.route.length; idx++) {
        // Insert the round-trip divider if this is the first return segment
        if (hasReturnSegments && idx === returnStartIndex) {
            segmentsHtml += `
                <div class="round-trip-divider" data-destination-text="${daysAtDestination}"></div>
            `;
        }
        
        const segment = flight.route[idx];
        const departureDate = segment.local_departure ? new Date(segment.local_departure) : new Date(segment.dTime * 1000);
        const arrivalDate = segment.local_arrival ? new Date(segment.local_arrival) : new Date(segment.aTime * 1000);
        const departureTime = formatTime(departureDate);
        const arrivalTime = formatTime(arrivalDate);
        
        // Calculate proper flight duration using the shared utility
        const durationResult = calculateFlightDuration(segment, false);
        const durationHours = calculateDurationHours(durationResult);
        
        const airlineLogoUrl = await airlineLogoManager.getLogoUrl(segment.airline);

        segmentsHtml += `
            <div class="segment-container">
                <div class="segment-details">
                    <div class="airline-section">
                        <img src="${airlineLogoUrl}" alt="${segment.airline} Logo" class="airline-logo">
                    </div>

                    <div class="journey-section">
                        <div class="departure-section">
                            <span class="departure-time">${departureTime}</span>
                            <span class="departure-code">${segment.flyFrom}</span>
                            <span class="departure-date">${departureDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                        </div>

                        <div class="route-indicator">
                            ${createDayNightBar(departureDate, arrivalDate, durationHours, segment)}
                        </div>

                        <div class="arrival-section">
                            <span class="arrival-time">${arrivalTime}</span>
                            <span class="arrival-code">${segment.flyTo}</span>
                            <span class="arrival-date">${arrivalDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                        </div>
                    </div>
                </div>`;
                
        // Add layover information if this isn't the last segment
        // And skip if this segment is the last outbound segment in a round trip
        if (idx < flight.route.length - 1) {
            // Check if this is the boundary between outbound and return journeys
            const isOutboundReturnBoundary = hasReturnSegments && idx === returnStartIndex - 1;
            
            // Only add layover if this is NOT the boundary between outbound and return
            if (!isOutboundReturnBoundary) {
                const nextSegment = flight.route[idx + 1];
                const nextDepartureDate = nextSegment.local_departure ? new Date(nextSegment.local_departure) : new Date(nextSegment.dTime * 1000);
                const layoverDurationHours = (nextDepartureDate - arrivalDate) / 3600000;
                
                segmentsHtml += `
                    <div class="layover-info">
                        ${createLayoverBar(arrivalDate, nextDepartureDate, layoverDurationHours)}
                    </div>
                `;
            }
        }
        
        segmentsHtml += `</div>`;
    }
    
    return segmentsHtml;
}

async function routeInfoCard(cardElement, fullFlightData, routeIds, routeIndex) {
    const routeId = createRouteId(fullFlightData.route);
    let existingDetailCard = cardElement.nextSibling;

    // Remove existing card
    if (existingDetailCard && existingDetailCard.classList.contains('route-info-card')) {
        cardElement.classList.remove('route-info-card-header', 'route-info-card');
        removeHighlighting(cardElement.getAttribute('data-route-id'));
        cardElement.parentNode.removeChild(existingDetailCard);
        return;
    }

    // Create detail card
    const detailCard = document.createElement('div');
    detailCard.className = 'route-info-card';
    
    // Redesigned detail card layout (segments + booking)
    detailCard.innerHTML = `
        <div class="route-info-card-content">
            <div class="segments-container">
                ${await generateSegmentDetails(fullFlightData)}
            </div>
            <div class="booking-container">
                <div class="baggage-info">
                    ${bagIcon}
                    <span class="baggage-price">${Math.ceil(fullFlightData.bags_price[1] * appState.eurToUsd)}</span>
                </div>
                <button id="selectRoute" class="select-button">
                    <span class="price-info">$${Math.ceil(fullFlightData.price)}</span>
                    <span class="select-label">Select flight</span>
                </button>
            </div>
        </div>
    `;
    
    cardElement.parentNode.insertBefore(detailCard, cardElement.nextSibling);
    highlightRoute(cardElement.getAttribute('data-route-id'));

    detailCard.addEventListener('mouseover', () => highlightRouteLines(fullFlightData, cardElement));
    detailCard.addEventListener('mouseout', () => resetRouteLines(cardElement));

    const addClickListener = (selector, attr, callback) => {
        detailCard.querySelectorAll(selector).forEach(element => {
            element.addEventListener('click', (event) => {
                event.stopPropagation();
                const value = element.getAttribute(attr);
                if (value) callback(value);
            });
        });
    };

    const fetchAndDisplayAirportData = async (origin, destination) => {
        const originData = flightMap.airportDataCache[origin];
        const destData = flightMap.airportDataCache[destination];
        
        if (originData && destData) {
            map.fitBounds([
                [originData.latitude, originData.longitude],
                [destData.latitude, destData.longitude]
            ]);
            return;
        }
    };

    addClickListener('.departure', 'data-origin', flyToLocation);
    addClickListener('.destination', 'data-destination', flyToLocation);
    addClickListener('.duration', 'data-origin', (origin) => {
        const destination = detailCard.querySelector('.duration').getAttribute('data-destination');
        fetchAndDisplayAirportData(origin, destination);
    });
    addClickListener('.layover', 'data-layover', flyToLocation);

    detailCard.querySelector('#selectRoute').addEventListener('click', () => {
        // Update routeData directly
        appState.routeData[routeIndex] = {
            ...appState.routeData[routeIndex],
            selectedRoute: fullFlightData
        };

        const intermediaryIatas = fullFlightData.route.map(segment => segment.flyFrom);
        intermediaryIatas.push(fullFlightData.route[fullFlightData.route.length - 1].flyTo);

        replaceWaypointsForCurrentRoute(intermediaryIatas, routeIndex);

        updateState('updateRouteData', {
            routeNumber: routeIndex,
            data: {
                departDate: fullFlightData.route[0].local_departure ? 
                    fullFlightData.route[0].local_departure.split('T')[0] : 
                    (fullFlightData.route[0].dTime ? 
                        new Date(fullFlightData.route[0].dTime * 1000).toISOString().split('T')[0] : 
                        new Date().toISOString().split('T')[0])
            }
        }, 'routeInfoCard.selectRoute');

        fullFlightData.route.forEach((segment, i) => {
            if (i < fullFlightData.route.length - 1) {
                const routeId = `${segment.flyFrom}-${fullFlightData.route[i + 1].flyTo}`;
                const lines = pathDrawing.routePathCache[routeId] || [];
                lines.forEach(line => line.addTag('status:selected'));
            }
        });

        // Call selectRoute to update the state and markers
        selectRoute(fullFlightData.route);
        
        // Update all route buttons belonging to this group to ensure they remain selected
        setTimeout(() => {
            // Force update of route button states for all segments in this group
            const routeSegmentIndices = fullFlightData.route.map((_, idx) => routeIndex + idx);
            routeSegmentIndices.forEach(segmentIndex => {
                const buttonId = `route-button-${segmentIndex}`;
                const segmentButton = document.getElementById(buttonId);
                if (segmentButton) {
                    segmentButton.classList.add('selected-route-button');
                    // Preserve even-button class if present
                    if (segmentIndex % 2 === 1) {
                        segmentButton.classList.add('even-button');
                    }
                }
            });
        }, 200);
        
        // Import the selectedRouteGroup module and display the full journey info instead of just the first segment
        import('../routeDeck/selectedRouteGroup.js').then(({ selectedRouteGroup }) => {
            // Import the selectedRoute module to get access to the format helpers
            import('../routeDeck/selectedRoute.js').then(({ selectedRoute }) => {
                // Small timeout to ensure state updates are processed
                setTimeout(() => {
                    // Create format helpers object to pass to the selectedRouteGroup module
                    const formatHelpers = {
                        formatFlightTime: selectedRoute.formatFlightTime,
                        formatFlightDate: selectedRoute.formatFlightDate
                    };
                    
                    // Set a default group ID if none exists in the route
                    if (!fullFlightData.group) {
                        // Generate a unique group ID
                        appState.highestGroupId = (appState.highestGroupId || 0) + 1;
                        fullFlightData.group = appState.highestGroupId;
                        
                        // Update routeData with the group ID
                        appState.routeData[routeIndex].selectedRoute.group = fullFlightData.group;
                    }
                    
                    // Display the full journey view for the group ID
                    selectedRouteGroup.displayFullJourneyInfo(fullFlightData.group || routeIndex, formatHelpers).then(result => {
                        // Check if we received valid journey data
                        if (result && result.journeyContainer && result.journeyData) {
                            // Set up event listeners for the journey view
                            selectedRouteGroup.setupJourneyEventListeners(
                                result.journeyContainer,
                                result.journeyData,
                                {
                                    onReturnToSegment: (segmentIndex) => selectedRoute.displaySelectedRouteInfo(segmentIndex),
                                    onViewSegment: (segmentIndex) => selectedRoute.displaySelectedRouteInfo(segmentIndex)
                                }
                            );
                            
                            // Update current view
                            appState.currentView = 'fullJourney';
                        } else {
                            // Fallback to displaying just the segment info
                            console.warn('Could not display full journey view, falling back to segment view');
                            selectedRoute.displaySelectedRouteInfo(routeIndex);
                        }
                    }).catch(error => {
                        console.error('Error displaying journey info:', error);
                        // Fallback to segment view on error
                        selectedRoute.displaySelectedRouteInfo(routeIndex);
                    });
                }, 100);
            });
        });
    });

    cardElement.classList.add('route-info-card', 'route-info-card-header');
    setSelectedRouteCard(routeIndex);
}

function setSelectedRouteCard(routeIndex) {
    document.querySelectorAll('.route-card').forEach(card => card.classList.remove('selected'));
    const selectedCard = document.querySelector(`.route-card[data-route-index="${routeIndex}"]`);
    if (selectedCard) selectedCard.classList.add('selected');
}

function highlightRoutePath(route) {
    const filterTags = constructFilterTags();
    const routeId = route.map(r => r.flyFrom).concat(route[route.length - 1].flyTo).join('-');
    highlightLines([...filterTags, `route:${routeId}`]);
}

function highlightRoute(routeId) {
    const filterTags = constructFilterTags();
    highlightLines([...filterTags, `route:${routeId}`]);
}

function removeHighlighting(routeId) {
    const filterTags = constructFilterTags();
    const linesToUnhighlight = lineManager.getLinesByTags([...filterTags, `route:${routeId}`], 'route');

    linesToUnhighlight.forEach(line => {
        line.removeTag('status:highlighted');
    });
}

function highlightLines(tags) {
    const linesToHighlight = lineManager.getLinesByTags(tags, 'route');
    linesToHighlight.forEach(line => {
        line.addTag('status:highlighted');
        line.visibleLine.setStyle({ color: 'white' });
    });
}

function flyToLocation(iata) {
    flightMap.getAirportDataByIata(iata)
        .then(airport => airport && map.flyTo([airport.latitude, airport.longitude]))
        .catch(error => console.error('Error getting airport data:', error));
}

function replaceWaypointsForCurrentRoute(intermediaryIatas, routeIndex) {
    // Since we're no longer using waypoints array, this function will directly update routeData
    // with all the segments from the selected route
    
    // Get trip type from routeData
    const routeData = appState.routeData[routeIndex];
    const tripType = routeData?.tripType || 'oneWay';
    
    // Create route data entries for each segment in the route
    for (let i = 0; i < intermediaryIatas.length - 1; i++) {
        const segmentIndex = routeIndex + i;
        const originIata = intermediaryIatas[i];
        const destIata = intermediaryIatas[i + 1];
        
        // Get airport data from cache
        const originData = flightMap.airportDataCache[originIata];
        const destData = flightMap.airportDataCache[destIata];
        
        if (!originData || !destData) {
            console.error(`Missing airport data for ${originIata} or ${destIata}`);
            continue;
        }
        
        // Create or update routeData for this segment
        if (!appState.routeData[segmentIndex]) {
            appState.routeData[segmentIndex] = {
                tripType: 'oneWay',
                travelers: 1,
                origin: { 
                    iata_code: originIata,
                    city: originData.city,
                    name: originData.name || originData.city
                },
                destination: {
                    iata_code: destIata,
                    city: destData.city,
                    name: destData.name || destData.city
                },
                isSegment: true
            };
        } else {
            // Update existing route data
            appState.routeData[segmentIndex].origin = {
                iata_code: originIata,
                city: originData.city,
                name: originData.name || originData.city
            };
            appState.routeData[segmentIndex].destination = {
                iata_code: destIata,
                city: destData.city,
                name: destData.name || destData.city
            };
            appState.routeData[segmentIndex].isSegment = true;
        }
    }
    
    // Update UI through routeHandling
    import('../routeHandling.js').then(({ routeHandling }) => {
        routeHandling.updateRoutesArray();
    });
}

function selectRoute(route) {
    // Update the selected route using routeData approach directly
    const selectedIatas = route.map(segment => segment.flyFrom);
    selectedIatas.push(route[route.length - 1].flyTo); // Add the final destination
    
    // Instead of setting appState.selectedRoute directly, we'll update via flightMap
    flightMap.updateVisibleMarkers(selectedIatas);
}

export { routeInfoCard, setSelectedRouteCard };
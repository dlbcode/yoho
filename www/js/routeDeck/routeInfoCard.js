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

const formatTime = (date) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const bagIcon = `<svg fill="#aaa" height="20px" width="20px" version="1.1" id="Layer_1" xmlns="http://www.w3.org/1999/xlink" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 248.35 248.35" xml:space="preserve"><g><path d="M186.057,66.136h-15.314V19.839C170.743,8.901,161.844,0,150.904,0H97.448c-10.938,0-19.84,8.901-19.84,19.839v46.296H62.295c-9.567,0-17.324,7.757-17.324,17.324V214.26c0,9.571,7.759,17.326,17.324,17.326h2.323v12.576c0,2.315,1.876,4.188,4.186,4.188h19.811c2.315,0,4.188-1.876,4.188-4.188v-12.576h62.741v12.576c0,2.315,1.878,4.188,4.188,4.188h19.809c2.317,0,4.188-1.876,4.188-4.188v-12.576h2.326c9.567,0,17.324-7.757,17.324-17.326V83.46C203.381,73.891,195.624,66.136,186.057,66.136z M157.514,66.135H90.832V19.839c0-3.646,2.967-6.613,6.613-6.613h53.456c3.646,0,6.613,2.967,6.613,6.613V66.135z"/></g></svg>`;

async function generateSegmentDetails(flight) {
    let segmentsHtml = '';
    
    for (let idx = 0; idx < flight.route.length; idx++) {
        const segment = flight.route[idx];
        const departureDate = segment.local_departure ? new Date(segment.local_departure) : new Date(segment.dTime * 1000);
        const arrivalDate = segment.local_arrival ? new Date(segment.local_arrival) : new Date(segment.aTime * 1000);
        const departureTime = formatTime(departureDate);
        const arrivalTime = formatTime(arrivalDate);
        
        // Calculate proper flight duration - prioritize API-provided duration values
        let durationHours;
        
        // First priority: segment.duration.flight (most accurate for actual flight time)
        if (segment.duration && typeof segment.duration.flight === 'number') {
            durationHours = segment.duration.flight / 3600;
        } 
        // Second priority: segment.duration total (if available as a number)
        else if (segment.duration && typeof segment.duration === 'number') {
            durationHours = segment.duration / 3600;
        }
        // Third priority: Parse the fly_duration string
        else if (segment.fly_duration) {
            const durMatch = segment.fly_duration.match(/(\d+)h\s*(?:(\d+)m)?/);
            if (durMatch) {
                const hours = parseInt(durMatch[1]) || 0;
                const mins = parseInt(durMatch[2]) || 0;
                durationHours = hours + mins/60;
            } else {
                // Fourth priority: Look for a flying_time property (some APIs provide this)
                if (segment.flying_time) {
                    durationHours = segment.flying_time / 3600; // Assuming seconds
                }
                // Last resort: Use the parent flight's duration if available and this is a single-segment flight
                else if (flight.duration && flight.route.length === 1) {
                    durationHours = flight.duration.flight 
                        ? flight.duration.flight / 3600 
                        : flight.duration / 3600;
                }
                // Final fallback: Estimate from timestamps (least accurate, affected by timezones)
                else {
                    // A reasonable flight time shouldn't exceed 20 hours for a single segment
                    const rawDuration = (arrivalDate - departureDate) / 3600000;
                    durationHours = rawDuration > 20 ? 
                        // If over 20 hours, it's probably a timezone/date issue - make an educated guess
                        Math.min(rawDuration % 24, 20) : 
                        rawDuration;
                }
            }
        }
        // If all else fails, use a reasonable fallback
        else {
            // Get the great circle distance between airports and estimate flight time
            const origin = flightMap.airportDataCache[segment.flyFrom];
            const destination = flightMap.airportDataCache[segment.flyTo];
            
            if (origin && destination) {
                // Calculate approximate flight time based on distance
                // Typical commercial aircraft: ~500 mph = ~800 km/h
                const lat1 = origin.latitude * Math.PI / 180;
                const lon1 = origin.longitude * Math.PI / 180;
                const lat2 = destination.latitude * Math.PI / 180;
                const lon2 = destination.longitude * Math.PI / 180;
                
                // Haversine formula for distance
                const R = 6371; // Earth's radius in km
                const dLat = lat2 - lat1;
                const dLon = lon2 - lon1;
                const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                          Math.cos(lat1) * Math.cos(lat2) *
                          Math.sin(dLon/2) * Math.sin(dLon/2);
                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                const distance = R * c; // Distance in km
                
                // Estimate flight time: distance/speed + 0.5h for takeoff/landing
                durationHours = distance / 800 + 0.5;
            } else {
                // If we can't even calculate distance, use a modest default
                durationHours = 3; // Default to 3 hours if we can't calculate
            }
        }
        
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
        if (idx < flight.route.length - 1) {
            const nextSegment = flight.route[idx + 1];
            const nextDepartureDate = nextSegment.local_departure ? new Date(nextSegment.local_departure) : new Date(nextSegment.dTime * 1000);
            const layoverDurationHours = (nextDepartureDate - arrivalDate) / 3600000;
            
            segmentsHtml += `
                <div class="layover-info">
                    ${createLayoverBar(arrivalDate, nextDepartureDate, layoverDurationHours)}
                </div>
            `;
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
                <div class="price-info">$${Math.ceil(fullFlightData.price)}</div>
                <button id="selectRoute" class="select-button">Select</button>
                <div class="baggage-info">
                    ${bagIcon}
                    <span class="baggage-price">${Math.ceil(fullFlightData.bags_price[1] * appState.eurToUsd)}</span>
                </div>
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
        appState.highestGroupId += 1;
        const newRouteGroupId = appState.highestGroupId;

        const existingRouteDetails = appState.selectedRoutes[routeIndex];
        if (existingRouteDetails) {
            Object.keys(appState.selectedRoutes).forEach(key => {
                if (appState.selectedRoutes[key].group === existingRouteDetails.group) {
                    updateState('removeSelectedRoute', parseInt(key));
                }
            });
        }

        lineManager.clearLines('route');

        const intermediaryIatas = fullFlightData.route.map(segment => segment.flyFrom);
        intermediaryIatas.push(fullFlightData.route[fullFlightData.route.length - 1].flyTo);

        fullFlightData.route.forEach((segmentData, idx) => {
            const selectedRouteIndex = routeIndex + idx;
            const departureDate = segmentData.local_departure ? new Date(segmentData.local_departure).toISOString().split('T')[0] : new Date(segmentData.dTime * 1000).toISOString().split('T')[0];
            const arrivalDate = segmentData.local_arrival ? new Date(segmentData.local_arrival).toISOString().split('T')[0] : new Date(segmentData.aTime * 1000).toISOString().split('T')[0];

            appState.selectedRoutes[selectedRouteIndex] = {
                displayData: {
                    departure: departureDate,
                    arrival: arrivalDate,
                    price: fullFlightData.price,
                    airline: segmentData.airline,
                    route: `${segmentData.flyFrom} > ${segmentData.flyTo}`,
                    deep_link: fullFlightData.deep_link
                },
                fullData: segmentData,
                group: newRouteGroupId,
                routeNumber: routeIndex,
                routeDates: { depart: departureDate, return: null }
            };

            // Update the route dates in appState
            if (!appState.routeDates[selectedRouteIndex]) appState.routeDates[selectedRouteIndex] = {};
            appState.routeDates[selectedRouteIndex].depart = departureDate;
        });

        replaceWaypointsForCurrentRoute(intermediaryIatas, routeIndex);

        updateState('updateRouteDate', {
            routeNumber: routeIndex,
            depart: fullFlightData.route[0].local_departure.split('T')[0],
            return: null
        });

        fullFlightData.route.forEach((segment, i) => {
            if (i < fullFlightData.route.length - 1) {
                const routeId = `${segment.flyFrom}-${fullFlightData.route[i + 1].flyTo}`;
                const lines = pathDrawing.routePathCache[routeId] || [];
                lines.forEach(line => line.addTag('status:selected'));
            }
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
    const tripType = appState.routes[routeIndex]?.tripType || 'oneWay';
    const startIndex = tripType === 'roundTrip' ? 0 : routeIndex * 2;
    const before = appState.waypoints.slice(0, startIndex);
    const after = tripType === 'roundTrip' ? [] : appState.waypoints.slice((routeIndex + 1) * 2);

    let updatedSegment = [flightMap.airportDataCache[intermediaryIatas[0]]];

    for (let i = 1; i < intermediaryIatas.length; i++) {
        let airportData = flightMap.airportDataCache[intermediaryIatas[i]];
        updatedSegment.push(airportData);
        if (i < intermediaryIatas.length - 1) {
            updatedSegment.push(airportData);
        }
    }

    const finalDestinationIata = intermediaryIatas[intermediaryIatas.length - 1];
    const originIata = intermediaryIatas[0];

    const shouldAddOrigin = tripType === 'roundTrip' && updatedSegment[updatedSegment.length - 1].iata_code !== originIata;
    const shouldAddDestination = tripType !== 'roundTrip' && updatedSegment[updatedSegment.length - 1].iata_code !== finalDestinationIata;

    if (shouldAddOrigin) {
        updatedSegment.push(flightMap.airportDataCache[originIata]);
    } else if (shouldAddDestination) {
        updatedSegment.push(flightMap.airportDataCache[finalDestinationIata]);
    }

    appState.waypoints = [...before, ...updatedSegment, ...after];
    updateState('updateWaypoint', appState.waypoints);
}

export { routeInfoCard, setSelectedRouteCard };
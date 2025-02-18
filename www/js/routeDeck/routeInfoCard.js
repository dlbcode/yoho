import { appState, updateState } from '../stateManager.js';
import { pathDrawing } from '../pathDrawing.js';
import { flightMap } from '../flightMap.js';
import { map } from '../map.js';
import { lineManager } from '../lineManager.js';
import { constructFilterTags, createRouteId } from './filterDeck.js';
import { highlightRouteLines, resetRouteLines } from './routeHighlighting.js';
import { formatFlightDateTime } from './routeCard.js'; // Import formatFlightDateTime

const formatTime = (date) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const bagIcon = `<svg fill="#aaa" height="20px" width="20px" version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 248.35 248.35" xml:space="preserve"><g><path d="M186.057,66.136h-15.314V19.839C170.743,8.901,161.844,0,150.904,0H97.448c-10.938,0-19.84,8.901-19.84,19.839v46.296H62.295c-9.567,0-17.324,7.757-17.324,17.324V214.26c0,9.571,7.759,17.326,17.324,17.326h2.323v12.576c0,2.315,1.876,4.188,4.186,4.188h19.811c2.315,0,4.188-1.876,4.188-4.188v-12.576h62.741v12.576c0,2.315,1.878,4.188,4.188,4.188h19.809c2.317,0,4.188-1.876,4.188-4.188v-12.576h2.326c9.567,0,17.324-7.757,17.324-17.326V83.46C203.381,73.891,195.624,66.136,186.057,66.136z M157.514,66.135H90.832V19.839c0-3.646,2.967-6.613,6.613-6.613h53.456c3.646,0,6.613,2.967,6.613,6.613V66.135z"/></g></svg>`;

function formatLayover(flight, idx) {
    if (idx >= flight.route.length - 1) return '';
    const arrivalTime = flight.route[idx].local_arrival ? new Date(flight.route[idx].local_arrival) : new Date(flight.route[idx].aTime * 1000);
    const departureTime = flight.route[idx + 1].local_departure ? new Date(flight.route[idx + 1].local_departure) : new Date(flight.route[idx + 1].dTime * 1000);
    const layoverDuration = (departureTime - arrivalTime) / 60000; // Minutes
    return `${Math.floor(layoverDuration / 60)}h ${layoverDuration % 60}m`;
}

function generateSegmentDetails(flight) {
    return `<div class="route-details">${flight.route.map((segment, idx, arr) => {
        const departureDate = segment.local_departure ? new Date(segment.local_departure) : new Date(segment.dTime * 1000);
        const arrivalDate = segment.local_arrival ? new Date(segment.local_arrival) : new Date(segment.aTime * 1000);
        const departureTime = formatTime(departureDate);
        const arrivalTime = formatTime(arrivalDate);
        const duration = ((arrivalDate - departureDate) / 3600000).toFixed(1) + ' hrs';
        const airlineLogoUrl = `assets/airline_logos/70px/${segment.airline}.png`;
        const isLastSegment = idx === arr.length - 1;

        let segmentHtml = '';

        if (idx === 0) {
            segmentHtml += `
                <div class="departure" style="margin-right: 2px;" data-origin="${segment.flyFrom}">
                    <div>${segment.flyFrom} (${segment.cityFrom})</div>
                    <div style="color: #999;">Depart: <span style="color: #ccc;">${departureTime}</span></div>
                </div>
                <div class="duration" data-origin="${segment.flyFrom}" data-destination="${segment.flyTo}">
                    <div style="position: relative; margin-top: 12px; color: #ccc;">
                        ${duration}
                        <svg style="position: absolute; bottom: 12px; left: 0px; width: 100%; height: 30px; overflow: visible;">
                            <path d="M2,35 Q45,-2 88,35" stroke="#666" fill="transparent" stroke-width="2" stroke-dasharray="1,4" stroke-dashoffset="6" stroke-linecap="round"></path>
                        </svg>
                    </div>
                    <img src="${airlineLogoUrl}" alt="${segment.airline} Logo" style="width: 60px; height: 60px; object-fit: contain; object-position: center; border-radius: 5px;"/>
                </div>`;
        } else {
            const layoverDuration = formatLayover(flight, idx - 1);
            const previousArrivalTime = flight.route[idx - 1].local_arrival ? formatTime(new Date(flight.route[idx - 1].local_arrival)) : formatTime(new Date(flight.route[idx - 1].aTime * 1000));
            const recheckBagsText = flight.route[idx - 1].bags_recheck_required ? '<div style="color: #FFBF00;">- Recheck bags</div>' : '';

            segmentHtml += `
                <div class="layover" data-layover="${flight.route[idx - 1].flyTo}">
                    <div>${flight.route[idx - 1].flyTo} (${segment.cityFrom})</div>
                    <div style="color: #999;">Arrive: <span style="color: #ccc;">${previousArrivalTime}</span></div>
                    <div style="text-align: center; color: #999;">&darr;</div>
                    <div style="color: #999;">Layover: <span style="color: #ccc;">${layoverDuration}</span></div>
                    ${recheckBagsText}
                    <div style="text-align: center; color: #999;">&darr;</div>
                    <div style="color: #999;">Depart: <span style="color: #ccc;">${departureTime}</span></div>
                </div>
                <div class="duration" data-origin="${segment.flyFrom}" data-destination="${segment.flyTo}">
                    <div style="position: relative; margin-top: 12px; color: #ccc;">
                        ${duration}
                        <svg style="position: absolute; bottom: 12px; left: 0px; width: 100%; height: 30px; overflow: visible;">
                            <path d="M2,35 Q45,-2 88,35" stroke="#666" fill="transparent" stroke-width="2" stroke-dasharray="1,4" stroke-dashoffset="6" stroke-linecap="round"></path>
                        </svg>
                    </div>
                    <img src="${airlineLogoUrl}" alt="${segment.airline} Logo" style="width: 60px; height: 60px; object-fit: contain; object-position: center; border-radius: 5px;"/>
                </div>`;
        }

        if (isLastSegment) {
            segmentHtml += `
                <div class="destination" data-destination="${segment.flyTo}">
                    <div>${segment.flyTo} (${segment.cityTo})</div>
                    <div style="color: #999;">Arrive: <span style="color: #ccc;">${arrivalTime}</span></div>
                </div>`;
        }

        return segmentHtml;
    }).join('')}</div>`;
}

function routeInfoCard(cardElement, fullFlightData, routeIds, routeIndex) {
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
    detailCard.innerHTML = `
        <div class="card-details">
            <div class="detail-group">
                <div class="detail-label">Airlines</div>
                <div class="detail-value">${fullFlightData.airlines.join(", ")}</div>
            </div>
            <div class="detail-group">
                <div class="detail-label">Stops</div>
                <div class="detail-value">${fullFlightData.route.length - 1}</div>
            </div>
            <div class="detail-group">
                <div class="detail-label">Departure</div>
                <div class="detail-value" data-departure="${formatFlightDateTime(new Date(fullFlightData.dTime * 1000))}">${formatFlightDateTime(new Date(fullFlightData.dTime * 1000))}</div>
            </div>
            <div class="detail-group">
                <div class="detail-label">Arrival</div>
                <div class="detail-value" data-arrival="${formatFlightDateTime(new Date(fullFlightData.aTime * 1000))}">${formatFlightDateTime(new Date(fullFlightData.aTime * 1000))}</div>
            </div>
        </div>
        <div class='route-details' style='display: flex; flex-direction: column; align-items: flex-start;'>
            <div class='top-wrapper' style='display: flex; flex-direction: card; align-items: flex-start'>
                <div class='left-wrapper' style='display: flex; flex-direction: column; align-items: flex-start; margin-right: 20px;'>
                    <button id='selectRoute' class="select-button">
                        <div style='font-size: 20px;'>${Math.ceil(fullFlightData.price)}</div>
                        <div>Select</div>
                    </button>
                    <div class="info-box" style="display: flex; flex-direction: card; margin-top: 4px; padding-bottom: 2px; width: 100%;">
                        <div class="bags-price" style="display: flex; flex-direction: column; align-items: center; margin-right: 5px;">
                            ${bagIcon}
                            <div style="padding: 2px 2px 4px 2px;font-size: 16px;color: #bbb;">${Math.ceil(fullFlightData.bags_price[1] * appState.eurToUsd)}</div>
                        </div>
                    </div>
                </div>
            </div>
            <div class='segments-wrapper' style='display: flex; flex-direction: column; align-items: flex-start;'>
                <div class='segments' style='display: flex; flex-direction: card; align-items: flex-start;'>
                    ${generateSegmentDetails(fullFlightData)}
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
            const departureDate = segmentData.local_departure || new Date(segmentData.dTime * 1000).toISOString();
            const arrivalDate = segmentData.local_arrival || new Date(segmentData.aTime * 1000).toISOString();

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
        });

        replaceWaypointsForCurrentRoute(intermediaryIatas, routeIndex);

        if (!appState.routeDates[routeIndex]) appState.routeDates[routeIndex] = {};
        appState.routeDates[routeIndex].depart = fullFlightData.route[0].local_departure;

        updateState('updateRouteDate', {
            routeNumber: routeIndex,
            depart: fullFlightData.route[0].local_departure,
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
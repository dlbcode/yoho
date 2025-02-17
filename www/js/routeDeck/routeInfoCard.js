import { appState, updateState } from '../stateManager.js';
import { pathDrawing } from '../pathDrawing.js';
import { flightMap } from '../flightMap.js';
import { map } from '../map.js';
import { lineManager } from '../lineManager.js';
import { constructFilterTags } from './filterDeck.js';

function formatLayover(flight, idx) {
    if (idx < flight.route.length - 1) {
        const arrivalTime = flight.route[idx].local_arrival ? new Date(flight.route[idx].local_arrival) : new Date(flight.route[idx].aTime * 1000);
        const departureTime = flight.route[idx + 1].local_departure ? new Date(flight.route[idx + 1].local_departure) : new Date(flight.route[idx + 1].dTime * 1000);
        const layoverDuration = (departureTime - arrivalTime) / 1000 / 60; // convert from ms to minutes
        return `${Math.floor(layoverDuration / 60)}h ${layoverDuration % 60}m`;
    }
    return '';
}

function generateSegmentDetails(flight) {
    let segmentsHtml = ['<div class="route-details">'];

    flight.route.forEach((segment, idx, arr) => {
        const options = { hour: '2-digit', minute: '2-digit' };
        const departureDate = segment.local_departure ? new Date(segment.local_departure) : new Date(segment.dTime * 1000);
        const arrivalDate = segment.local_arrival ? new Date(segment.local_arrival) : new Date(segment.aTime * 1000);
        const departureTime = departureDate.toLocaleTimeString([], options);
        const arrivalTime = arrivalDate.toLocaleTimeString([], options);
        const duration = ((arrivalDate - departureDate) / 3600000).toFixed(1) + ' hrs';
        const airlineCode = segment.airline;
        const airlineLogoUrl = `assets/airline_logos/70px/${airlineCode}.png`;

        if (idx === 0) {
            // Origin Column
            segmentsHtml.push(`
                <div class="departure" style="margin-right: 2px;" data-origin="${segment.flyFrom}">
                    <div>${segment.flyFrom} (${segment.cityFrom})</div>
                    <div style="color: #999;">Depart: <span style="color: #ccc;">${departureTime}</span></div>
                </div>`);

            // First Duration Column 
            segmentsHtml.push(`
                <div class="duration" data-origin="${segment.flyFrom}" data-destination="${segment.flyTo}">
                    <div style="position: relative; margin-top: 12px; color: #ccc;">
                        ${duration}
                        <svg style="position: absolute; bottom: 12px; left: 0px; width: 100%; height: 30px; overflow: visible;">
                            <path d="M2,35 Q45,-2 88,35" stroke="#666" fill="transparent" stroke-width="2" stroke-dasharray="1,4" stroke-dashoffset="6" stroke-linecap="round"></path>
                        </svg>
                    </div>
                    <img src="${airlineLogoUrl}" alt="${airlineCode} Logo" style="width: 60px; height: 60px; object-fit: contain; object-position: center; border-radius: 5px;"/>
                </div>`);
        }

        if (idx > 0) {
            // Layover Column
            const layoverDuration = formatLayover(flight, idx - 1);
            const previousArrivalTime = flight.route[idx - 1].local_arrival ? new Date(flight.route[idx - 1].local_arrival).toLocaleTimeString() : new Date(flight.route[idx - 1].aTime * 1000).toLocaleTimeString();
            const recheckBagsText = flight.route[idx - 1].bags_recheck_required ? '<div style="color: #FFBF00;">- Recheck bags</div>' : '';
            
            segmentsHtml.push(`
                <div class="layover" data-layover="${flight.route[idx - 1].flyTo}">
                    <div>${flight.route[idx - 1].flyTo} (${segment.cityFrom})</div>
                    <div style="color: #999;">Arrive: <span style="color: #ccc;">${previousArrivalTime}</span></div>
                    <div style="text-align: center; color: #999;">&darr;</div>
                    <div style="color: #999;">Layover: <span style="color: #ccc;">${layoverDuration}</span></div>
                    ${recheckBagsText}
                    <div style="text-align: center; color: #999;">&darr;</div>
                    <div style="color: #999;">Depart: <span style="color: #ccc;">${departureTime}</span></div>
                </div>`);

            // Another Duration Column
            segmentsHtml.push(`
                <div class="duration" data-origin="${flight.route[idx].flyFrom}" data-destination="${flight.route[idx].flyTo}">
                    <div style="position: relative; margin-top: 12px; color: #ccc;">
                        ${duration}
                        <svg style="position: absolute; bottom: 12px; left: 0px; width: 100%; height: 30px; overflow: visible;">
                            <path d="M2,35 Q45,-2 88,35" stroke="#666" fill="transparent" stroke-width="2" stroke-dasharray="1,4" stroke-dashoffset="6" stroke-linecap="round"></path>
                        </svg>
                    </div>
                    <img src="${airlineLogoUrl}" alt="${airlineCode} Logo" style="width: 60px; height: 60px; object-fit: contain; object-position: center; border-radius: 5px;"/>
                </div>`);
        }

        if (idx === arr.length - 1) {
            // Destination Column
            segmentsHtml.push(`
                <div class="destination" data-destination="${segment.flyTo}">
                    <div>${segment.flyTo} (${segment.cityTo})</div>
                    <div style="color: #999;">Arrive: <span style="color: #ccc;">${arrivalTime}</span></div>
                </div>`);
        }
    });

    segmentsHtml.push('</div>'); // Close route-details
    return segmentsHtml.join('');
}

// Change function name to match card terminology
function routeInfoCard(rowElement, fullFlightData, routeIds, routeIndex) {
    // Toggle details row visibility
    let existingDetailCard = rowElement.nextSibling;
    if (existingDetailCard && existingDetailCard.classList.contains('route-info-card')) {
        // Remove the existing details card if clicked again
        rowElement.parentNode.removeChild(existingDetailCard);
        rowElement.classList.remove('route-info-card-header');
        rowElement.classList.remove('route-info-card');

        // Remove 'status:highlighted' tag from associated lines
        const filterTags = constructFilterTags();
        const linesToUnhighlight = lineManager.getLinesByTags([...filterTags, `route:${rowElement.getAttribute('data-route-id')}`], 'route');

        linesToUnhighlight.forEach(line => {
            line.removeTag('status:highlighted');
        });

        return; // Exit the function after removing the card
    }

    // Create a new card for detailed information
    const detailCard = document.createElement('div');
    detailCard.className = 'route-info-card'; // Use a different class name
    const flight = fullFlightData;

    detailCard.innerHTML = `
        <div class='route-details' style='display: flex; flex-direction: column; align-items: flex-start;'>
            <div class='top-wrapper' style='display: flex; flex-direction: row; align-items: flex-start'>
                <div class='left-wrapper' style='display: flex; flex-direction: column; align-items: flex-start; margin-right: 20px;'>
                    <button id='selectRoute' class="select-button">
                        <div style='font-size: 20px;'>${Math.ceil(flight.price)}</div>
                        <div>Select</div>
                    </button>
                    <div class="info-box" style="display: flex; flex-direction: row; margin-top: 4px; padding-bottom: 2px; width: 100%;">
                        <div class="bags-price" style="display: flex; flex-direction: column; align-items: center; margin-right: 5px;">
                            <svg fill="#aaa" height="20px" width="20px" version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 248.35 248.35" xml:space="preserve">
                                <g>
                                    <path d="M186.057,66.136h-15.314V19.839C170.743,8.901,161.844,0,150.904,0H97.448c-10.938,0-19.84,8.901-19.84,19.839v46.296H62.295c-9.567,0-17.324,7.757-17.324,17.324V214.26c0,9.571,7.759,17.326,17.324,17.326h2.323v12.576c0,2.315,1.876,4.188,4.186,4.188h19.811c2.315,0,4.188-1.876,4.188-4.188v-12.576h62.741v12.576c0,2.315,1.878,4.188,4.188,4.188h19.809c2.317,0,4.188-1.876,4.188-4.188v-12.576h2.326c9.567,0,17.324-7.757,17.324-17.326V83.46C203.381,73.891,195.624,66.136,186.057,66.136z M157.514,66.135H90.832V19.839c0-3.646,2.967-6.613,6.613-6.613h53.456c3.646,0,6.613,2.967,6.613,6.613V66.135z"/>
                                </g>
                            </svg>
                            <div style="padding: 2px 2px 4px 2px;font-size: 16px;color: #bbb;">${Math.ceil(flight.bags_price[1] * appState.eurToUsd)}</div>
                        </div>
                    </div>
                </div>
            </div>
            <div class='segments-wrapper' style='display: flex; flex-direction: column; align-items: flex-start;'>
                <div class='segments' style='display: flex; flex-direction: row; align-items: flex-start;'>
                    ${generateSegmentDetails(flight)}
                </div>                
            </div>
        </div>
    `;

    // Insert the new card right after the clicked card in the container
    if (rowElement.nextSibling) {
        rowElement.parentNode.insertBefore(detailCard, rowElement.nextSibling);
    } else {
        rowElement.parentNode.appendChild(detailCard); // Append to the end if there's no next sibling
    }

    // Add 'status:highlighted' tag to associated lines
    const filterTags = constructFilterTags();
    const linesToHighlight = lineManager.getLinesByTags([...filterTags, `route:${rowElement.getAttribute('data-route-id')}`], 'route');

    linesToHighlight.forEach(line => {
        line.addTag('status:highlighted');
        line.visibleLine.setStyle({ color: 'white' });
    });

    detailCard.addEventListener('mouseover', () => {
        highlightRoutePath(fullFlightData.route);
    });

    detailCard.addEventListener('mouseout', () => {
        lineManager.clearLines('hover'); // Use lineManager instead of pathDrawing
    });

    function addClickListener(element, attr, callback) {
        if (!element) return;
        element.addEventListener('click', (event) => {
            event.stopPropagation();
            const value = element.getAttribute(attr);
            if (value) {
                callback(value);
            }
        });
    }

    async function fetchAndDisplayAirportData(origin, destination) {
        // Check memory cache first
        const originData = flightMap.airportDataCache[origin];
        const destData = flightMap.airportDataCache[destination];
        
        if (originData && destData) {
            map.fitBounds([
                [originData.latitude, originData.longitude],
                [destData.latitude, destData.longitude]
            ]);
            return;
        }
        // Fallback to API fetch if not cached
    }

    const departureColumn = detailCard.querySelector('.departure');
    addClickListener(departureColumn, 'data-origin', flyToLocation);

    const destinationColumn = detailCard.querySelector('.destination');
    addClickListener(destinationColumn, 'data-destination', flyToLocation);

    const durationColumn = detailCard.querySelectorAll('.duration');
    durationColumn.forEach(column => {
        addClickListener(column, 'data-origin', (origin) => {
            const destination = column.getAttribute('data-destination');
            fetchAndDisplayAirportData(origin, destination);
        });
    });

    const layoverColumn = detailCard.querySelectorAll('.layover');
    layoverColumn.forEach(column => {
        column.addEventListener('click', (event) => {
            event.stopPropagation();
            const layover = column.getAttribute('data-layover');
            flyToLocation(layover);
        });
    });

    const selectRouteButton = detailCard.querySelector('#selectRoute');
    selectRouteButton.addEventListener('click', () => {
        console.log('Selecting route:', fullFlightData);
        
        // Use same group ID for all segments
        appState.highestGroupId += 1;
        const newRouteGroupId = appState.highestGroupId;
        
        // Remove existing routes with same group if any
        const existingRouteDetails = appState.selectedRoutes[routeIndex];
        if (existingRouteDetails) {
            Object.keys(appState.selectedRoutes).forEach(key => {
                if (appState.selectedRoutes[key].group === existingRouteDetails.group) {
                    updateState('removeSelectedRoute', parseInt(key));
                }
            });
        }

        lineManager.clearLines('route'); // Use proper method from lineManager

        // Get all IATA codes from the route for waypoint updating
        const intermediaryIatas = fullFlightData.route.map(segment => segment.flyFrom);
        intermediaryIatas.push(fullFlightData.route[fullFlightData.route.length - 1].flyTo);

        // Process each segment with the same group ID
        fullFlightData.route.forEach((segmentData, idx) => {
            const selectedRouteIndex = routeIndex + idx;
            
            // Extract departure and arrival times
            const departureDate = segmentData.local_departure || 
                                new Date(segmentData.dTime * 1000).toISOString();
            const arrivalDate = segmentData.local_arrival || 
                               new Date(segmentData.aTime * 1000).toISOString();
            
            // Update selected routes
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
                routeDates: {
                    depart: departureDate,
                    return: null
                }
            };
        });

        // Update waypoints for the entire route
        replaceWaypointsForCurrentRoute(intermediaryIatas, routeIndex);

        // Update route dates in appState
        if (!appState.routeDates[routeIndex]) {
            appState.routeDates[routeIndex] = {};
        }
        appState.routeDates[routeIndex].depart = fullFlightData.route[0].local_departure;
        
        // Trigger necessary state updates
        updateState('updateRouteDate', {
            routeNumber: routeIndex,
            depart: fullFlightData.route[0].local_departure,
            return: null
        });
        
        // Add 'status:selected' tag to the route lines
        const routeSegments = fullFlightData.route;
        for (let i = 0; i < routeSegments.length - 1; i++) {
            const routeId = `${routeSegments[i].flyFrom}-${routeSegments[i+1].flyTo}`;
            const lines = pathDrawing.routePathCache[routeId] || [];
            lines.forEach(line => {
                line.addTag('status:selected');
            });
        }
    });

    // add selected class to the clicked card in the container
    rowElement.classList.add('route-info-card');
    rowElement.classList.add('route-info-card-header');
    highlightSelectedCardForRouteIndex(routeIndex);
}

// This function name and implementation should be updated
function highlightSelectedCardForRouteIndex(routeIndex) {
    // Update selectors to use cards instead of table rows
    document.querySelectorAll(`.route-card[data-route-index="${routeIndex}"]`).forEach(card => {
        card.classList.remove('selected');
    });

    const selectedRouteDetails = appState.selectedRoutes[routeIndex];
    if (selectedRouteDetails && selectedRouteDetails.id) {
        let selectedCard = document.querySelector('.route-card');
        if (!selectedCard) {
            document.querySelectorAll(`.route-card[data-route-index="${routeIndex}"]`).forEach(card => {
                const routeId = card.getAttribute('data-route-id');
                if (routeId && routeId.split('|').includes(selectedRouteDetails.id)) {
                    selectedCard = card;
                }
            });
        }

        if (selectedCard) {
            selectedCard.classList.add('selected');
        }
    }
}

function highlightRoutePath(route) {
    const filterTags = constructFilterTags();
    const routeId = route.map(r => r.flyFrom).concat(route[route.length - 1].flyTo).join('-');
    
    // Add 'status:highlighted' tag to the relevant lines
    const linesToHighlight = lineManager.getLinesByTags([...filterTags, `route:${routeId}`], 'route');
    linesToHighlight.forEach(line => {
        line.addTag('status:highlighted');
        line.visibleLine.setStyle({ color: 'white' });
    });
}

function flyToLocation(iata) {
    flightMap.getAirportDataByIata(iata).then(airport => {
        if (airport) {
            const lat = airport.latitude;
            const lng = airport.longitude;
            map.flyTo([lat, lng]);
        }
    }).catch(error => {
        console.error('Error getting airport data:', error);
    });
}

function replaceWaypointsForCurrentRoute(intermediaryIatas, routeIndex) {
    const tripType = appState.routes[routeIndex] ? appState.routes[routeIndex].tripType : 'oneWay'; // Default to oneWay if not set
    const startIndex = tripType === 'roundTrip' ? 0 : routeIndex * 2;
    let before = appState.waypoints.slice(0, startIndex);
    let after = tripType === 'roundTrip' ? [] : appState.waypoints.slice((routeIndex + 1) * 2);

    let updatedSegment = [flightMap.airportDataCache[intermediaryIatas[0]]];

    for (let i = 1; i < intermediaryIatas.length; i++) {
        let airportData = flightMap.airportDataCache[intermediaryIatas[i]];
        updatedSegment.push(airportData);
        if (i < intermediaryIatas.length - 1) {
            updatedSegment.push(airportData);
        }
    }

    // For round trips, ensure the return to the origin is explicitly handled
    if (tripType === 'roundTrip') {
        const originIata = intermediaryIatas[0];
        if (updatedSegment[updatedSegment.length - 1].iata_code !== originIata) {
            updatedSegment.push(flightMap.airportDataCache[originIata]);
        }
    } else {
        // For non-round trips, ensure the final destination is added if not already present
        const finalDestinationIata = intermediaryIatas[intermediaryIatas.length - 1];
        if (updatedSegment[updatedSegment.length - 1].iata_code !== finalDestinationIata) {
            updatedSegment.push(flightMap.airportDataCache[finalDestinationIata]);
        }
    }

    appState.waypoints = [...before, ...updatedSegment, ...after];
    updateState('updateWaypoint', appState.waypoints);
}

export { routeInfoCard, highlightSelectedCardForRouteIndex };
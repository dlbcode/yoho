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
                                    <path d="M186.057,66.136h-15.314V19.839C170.743,8.901,161.844,0,150.904,0H97.448c-10.938,0-19.84,8.901-19.84,19.839v46.296H62.295c-9.567,0-17.324,7.757-17.324,17.324V214.26c0,9.571,7.759,17.326,17.324,17.326h2.323v12.576c0,2.315,1.876,4.188,4.186,4.188h19.811c2.315,0,4.188-1.876,4.188-4.188v-12.576h62.741v12.576c0,2.315,1.876,4.188,4.188,4.188h19.811c2.315,0,4.188-1.876,4.188-4.188v-12.576h2.323c9.565,0,17.324-7.755,17.324-17.326V83.461C203.381,73.896,195.622,66.136,186.057,66.136z M93.262,231.586h-15.69c-2.311,0-4.186-1.876-4.186-4.188v-12.576h19.876c2.311,0,4.186,1.876,4.186,4.188v12.576C97.448,229.71,95.573,231.586,93.262,231.586z M155.09,231.586h-15.69c-2.311,0-4.188-1.876-4.188-4.188v-12.576h19.878c2.311,0,4.188,1.876,4.188,4.188v12.576C159.276,229.71,157.4,231.586,155.09,231.586z M186.057,214.26c0,0.813-0.661,1.474-1.474,1.474H63.769c-0.813,0-1.474-0.661-1.474-1.474V83.461c0-0.813,0.661-1.474,1.474-1.474h120.814c0.813,0,1.474,0.661,1.474,1.474V214.26z"/>
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
        if (!origin || !destination) return;
        const apiKey = 'YOUR_AIRPORT_API_KEY'; // Replace with your actual API key
        const apiUrl = `https://example.com/api/airports?origin=${origin}&destination=${destination}&apiKey=${apiKey}`;

        try {
            const response = await fetch(apiUrl);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            console.log('Airport Data:', data);
            // Display airport data in a popup or a designated area
        } catch (error) {
            console.error('Error fetching airport data:', error);
        }
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

        // Draw lines for the selected route
        fullFlightData.route.forEach((segment, idx) => {
            if (idx < fullFlightData.route.length - 1) {
                const nextSegment = fullFlightData.route[idx + 1];
                const routeId = `${segment.flyFrom}-${segment.flyTo}`;
                const routeData = {
                    price: flight.price,
                    origin: segment.flyFrom,
                    destination: segment.flyTo,
                    departureTime: segment.local_departure,
                    arrivalTime: segment.local_arrival,
                    airline: flight.airlines[0],
                    group: newRouteGroupId,
                    routeNumber: routeIndex,
                    displayData: {
                        price: flight.price,
                        airline: flight.airlines[0],
                        route: `${segment.flyFrom} > ${segment.flyTo}`,
                        deep_link: flight.deep_link
                    }
                };
                pathDrawing.drawLine(routeId, 'route', {
                    price: flight.price,
                    iata: segment.flyFrom,
                    routeData
                });
            }
        });

        updateState('addSelectedRoute', {
            routeNumber: routeIndex,
            id: routeIds[0],
            displayData: {
                price: flight.price,
                airline: flight.airlines[0],
                route: `${fullFlightData.route[0].flyFrom} > ${fullFlightData.route[fullFlightData.route.length - 1].flyTo}`,
                deep_link: flight.deep_link
            },
            group: newRouteGroupId
        });

        pathDrawing.drawLines(); // Keep this to redraw other paths
    });

    // add selected class to the clicked card in the container
    rowElement.classList.add('route-info-card');
    rowElement.classList.add('route-info-card-header');
    highlightSelectedRowForRouteIndex(routeIndex);
}

function highlightSelectedRowForRouteIndex(routeIndex) {
    document.querySelectorAll(`.route-info-deck[data-route-index="${routeIndex}"] tbody tr.selected`).forEach(row => {
        row.classList.remove('selected');
    });

    const selectedRouteDetails = appState.selectedRoutes[routeIndex];
    if (selectedRouteDetails && selectedRouteDetails.id) {
        let selectedRow = document.querySelector('.route-info-deck tbody tr');
        if (!selectedRow) {
            document.querySelectorAll(`.route-info-deck[data-route-index="${routeIndex}"] tbody tr`).forEach(row => {
                const routeId = row.getAttribute('data-route-id');
                if (routeId && routeId.split('|').includes(selectedRouteDetails.id)) {
                    selectedRow = row;
                }
            });
        }

        if (selectedRow) {
            selectedRow.classList.add('selected');
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

export { routeInfoCard, highlightSelectedRowForRouteIndex };
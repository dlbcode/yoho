import { appState, updateState } from '../stateManager.js';
import { pathDrawing } from '../pathDrawing.js';
import { flightMap } from '../flightMap.js';

function formatLayover(flight, idx) {
    if (idx < flight.route.length - 1) {
        const arrivalTime = new Date(flight.route[idx].local_arrival);
        const departureTime = new Date(flight.route[idx + 1].local_departure);
        const layoverDuration = (departureTime - arrivalTime) / 1000 / 60;  // convert from ms to minutes
        return `${Math.floor(layoverDuration / 60)}h ${layoverDuration % 60}m`;
    }
    return '';
}

function routeInfoRow(rowElement, fullFlightData, routeIds, routeIndex) {
    console.log('routeInfoRow called with:', rowElement, fullFlightData, routeIds, routeIndex);

    // Toggle details row visibility
    let existingDetailRow = rowElement.nextSibling;
    if (existingDetailRow && existingDetailRow.classList.contains('route-info-row')) {
        // Remove the existing details row if clicked again
        rowElement.parentNode.removeChild(existingDetailRow);
        rowElement.classList.remove('route-info-row-header');
        rowElement.classList.remove('route-info-row');
        return; // Exit the function after removing the row
    }

    // Create a new row for detailed information
    const detailRow = document.createElement('tr');
    const detailCell = document.createElement('td');
    const flight = fullFlightData;
    detailCell.colSpan = 9;  // Assuming there are 9 columns in your table

    function generateSegmentDetails(flight) {
        let segmentsHtml = ['<div class="route-details">'];
    
        flight.route.forEach((segment, idx, arr) => {
            const options = { hour: '2-digit', minute: '2-digit' };
            const departureTime = new Date(segment.local_departure).toLocaleTimeString([], options);
            const arrivalTime = new Date(segment.local_arrival).toLocaleTimeString([], options);
            const airlineCode = segment.airline; // Assuming `segment.airline` holds the airline code
            const duration = ((new Date(segment.local_arrival) - new Date(segment.local_departure)) / 3600000).toFixed(1) + ' hrs';
    
            const airlineLogoUrl = `assets/airline_logos/70px/${airlineCode}.png`;

            if (idx === 0) {
                // Origin Column
                segmentsHtml.push(`<div class="departure" style="margin-right: 2px;"><div>${segment.flyFrom} (${segment.cityFrom})</div><div style="color: #999;">Depart: <span style="color: #ccc;">${departureTime}</span></div></div>`);
                // First Duration Column
                segmentsHtml.push(`<div class="duration"><div style="position: relative; margin-top: 12px; color: #ccc;">
                ${duration}
                <svg style="position: absolute; bottom: 12px; left: 0px; width: 100%; height: 30px; overflow: visible;">
                <path d="M2,35 Q45,-2 88,35" stroke="#666" fill="transparent" stroke-width="4" stroke-dasharray="1,11" stroke-dashoffset="6" stroke-linecap="round"></path>
                </svg></div><img src="${airlineLogoUrl}" alt="${airlineCode} Logo" style="width: 60px; height: 60px; object-fit: contain; object-position: center; border-radius: 5px;"/></div>`);
                }

                if (idx > 0) {
                    // Layover Column (for all segments except the first)
                    const layoverDuration = formatLayover(flight, idx - 1);
                    const previousArrivalTime = new Date(flight.route[idx - 1].local_arrival).toLocaleTimeString();
                    const recheckBagsText = flight.route[idx - 1].bags_recheck_required ? '<div style="color: #FFBF00;">- Recheck bags</div>' : '';
                    segmentsHtml.push(`<div class="layover"><div>${flight.route[idx - 1].flyTo} (${segment.cityFrom})</div><div style="color: #999;">Arrive: <span style="color: #ccc;">${previousArrivalTime}</span></div><div style="text-align: center; color: #999;">&darr;</div><div style="color: #999;">Layover: <span style="color: #ccc;">${layoverDuration}</span></div>${recheckBagsText}<div style="text-align: center; color: #999;">&darr;</div><div style="color: #999;">Depart: <span style="color: #ccc;">${departureTime}</span></div></div>`);
                
                // Second Duration Column
                segmentsHtml.push(`<div class="duration"><div style="position: relative; margin-top: 12px; color: #ccc;">
                ${duration}
                <svg style="position: absolute; bottom: 12px; left: 0px; width: 100%; height: 30px; overflow: visible;">
                <path d="M2,35 Q45,-2 88,35" stroke="#666" fill="transparent" stroke-width="4" stroke-dasharray="1,11" stroke-dashoffset="6" stroke-linecap="round"></path>
                </svg></div><img src="${airlineLogoUrl}" alt="${airlineCode} Logo" style="width: 60px; height: 60px; object-fit: contain; object-position: center; border-radius: 5px;"/></div>`);
                }
    
            if (idx === arr.length - 1) {
                // Destination Column (for the last segment)
                segmentsHtml.push(`<div class="destination"><div>${segment.flyTo} (${segment.cityTo})</div><div style="color: #999;">Arrive: <span style="color: #ccc;">${arrivalTime}</span></div></div>`);
            }
        });
    
        segmentsHtml.push('</div>'); // Close route-details
        return segmentsHtml.join('');
    }                   
                       
    detailCell.innerHTML = `
    <div class='route-details' style='display: flex; flex-direction: column; align-items: flex-start;'>
        <div class='top-wrapper' style='display: flex; flex-direction: row; align-items: flex-start'>
            <div class='left-wrapper' style='display: flex; flex-direction: column; align-items: flex-start; margin-right: 20px;'>
               <button id='selectRoute' class="select-button">
                    <div style='font-size: 20px;'>$${Math.ceil(flight.price)}</div>
                    <div>Select</div>
                </button>
                <div class="info-box" style="display: flex; flex-direction: row; margin-top: 4px; padding-bottom: 2px; width: 100%;">
                <svg fill="#aaa" height="20px" width="20px" version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" 
                    viewBox="0 0 248.35 248.35" xml:space="preserve">
                    <g>
                        <g>
                        <path d="M186.057,66.136h-15.314V19.839C170.743,8.901,161.844,0,150.904,0H97.448c-10.938,0-19.84,8.901-19.84,19.839v46.296
                            H62.295c-9.567,0-17.324,7.757-17.324,17.324V214.26c0,9.571,7.759,17.326,17.324,17.326h2.323v12.576
                            c0,2.315,1.876,4.188,4.186,4.188h19.811c2.315,0,4.188-1.876,4.188-4.188v-12.576h62.741v12.576c0,2.315,1.878,4.188,4.188,4.188
                            h19.809c2.317,0,4.188-1.876,4.188-4.188v-12.576h2.326c9.567,0,17.324-7.757,17.324-17.326V83.46
                            C203.381,73.891,195.624,66.136,186.057,66.136z M157.514,66.135H90.832V19.839c0-3.646,2.967-6.613,6.613-6.613h53.456
                            c3.646,0,6.613,2.967,6.613,6.613V66.135z"/>
                        </g>
                    </g>
                </svg>
                <div style="padding: 2px 2px 4px 2px;font-size: 16px;color: #bbb;">$${Math.ceil(flight.bags_price[1] * appState.eurToUsd)}</div>
                </div>
            </div>
            <div class='segments-wrapper' style='display: flex; flex-direction: column; align-items: flex-start;'>
                <div class='segments' style='display: flex; flex-direction: row; align-items: flex-start;'>
                    ${generateSegmentDetails(flight)}
                </div>             
            </div>
        </div>
    </div>
`;
    detailRow.classList.add('route-info-row');
    detailRow.appendChild(detailCell);

    // add selected class to the clicked row in the table
    rowElement.classList.add('route-info-row');
    rowElement.classList.add('route-info-row-header');

    // Insert the new row right after the clicked row in the table
    if (rowElement.nextSibling) {
        rowElement.parentNode.insertBefore(detailRow, rowElement.nextSibling);
    } else {
        rowElement.parentNode.appendChild(detailRow);  // Append to the end if there's no next sibling
    }

    detailRow.addEventListener('mouseover', () => {
      highlightRoutePath(fullFlightData.route);
    });

    detailRow.addEventListener('mouseout', () => {
        pathDrawing.clearLines();  // Clear the highlighted route path
        pathDrawing.drawLines();  // Optionally redraw other paths if needed
    });

    const selectRouteButton = detailCell.querySelector('#selectRoute');
    selectRouteButton.addEventListener('click', () => {
      console.log('selectRouteButton clicked');
           // Determine the group ID for the newly selected route
           appState.highestGroupId += 1;
           let newRouteGroupId = appState.highestGroupId;
           const existingRouteDetails = appState.selectedRoutes[routeIndex];
           if (existingRouteDetails) {
               // Logic to remove routes from the old group, if necessary
               Object.keys(appState.selectedRoutes).forEach(key => {
                   if (appState.selectedRoutes[key].group == existingRouteDetails.group) {
                       updateState('removeSelectedRoute', parseInt(key));
                   }
               });
           }

           const departureDate = new Date((fullFlightData.local_departure || fullFlightData.dTime * 1000)).toISOString().split('T')[0];
    
           // Update appState for the selected route
           routeIds.forEach((id, idx) => {
               const segmentData = fullFlightData.route[idx];
               console.log('segmentData:', segmentData);
               const departureDate = new Date(segmentData.local_departure || segmentData.dTime).toISOString().split('T')[0];
               const displayData = {
                   departure: new Date((segmentData.local_departure || segmentData.dTime * 1000)).toLocaleString(),
                   arrival: new Date((segmentData.local_arrival || segmentData.aTime * 1000)).toLocaleString(),
                   price: `$${fullFlightData.price}`,
                   airline: segmentData.airline,
                   stops: fullFlightData.route.length - 1,
                   route: `${segmentData.flyFrom} > ${segmentData.flyTo}`,
                   deep_link: fullFlightData.deep_link,
               };
    
               const selectedRouteIndex = routeIndex + idx;
               if (!appState.routeDates[selectedRouteIndex]) {
                   appState.routeDates[selectedRouteIndex] = departureDate;
               }
    
               if (appState.selectedRoutes.hasOwnProperty(selectedRouteIndex)) {
                 const keys = Object.keys(appState.selectedRoutes).map(Number).filter(key => key >= selectedRouteIndex).sort((a, b) => b - a); // Sort keys in descending order to avoid overwriting
                 keys.forEach(key => {
                     appState.selectedRoutes[key + 1] = appState.selectedRoutes[key]; // Shift each route up by one index
                 });
             }
             
             appState.selectedRoutes[selectedRouteIndex] = {
                 displayData: displayData,
                 fullData: segmentData,
                 group: newRouteGroupId !== null ? newRouteGroupId : routeIndex,
                 routeDates: departureDate,
             };
           });
           const routeIATAs = fullFlightData.route.map(r => r.flyFrom).concat(fullFlightData.route[flight.route.length - 1].flyTo).join(" > ");
           const routeString = routeIATAs.trim(); // Assuming the IATA codes are in the 9th column
           const iataCodes = routeString.split(' > ');
           replaceWaypointsForCurrentRoute(iataCodes, routeIndex);
           updateState('updateRouteDate: ', routeIndex, departureDate);
           updateState('changeView', 'trip');
           highlightSelectedRowForRouteIndex(routeIndex);
  });
}

function highlightSelectedRowForRouteIndex(routeIndex) {
  document.querySelectorAll(`.route-info-table[data-route-index="${routeIndex}"] tbody tr.selected`).forEach(row => {
    row.classList.remove('selected');
  });

  const selectedRouteDetails = appState.selectedRoutes[routeIndex];
  if (selectedRouteDetails && selectedRouteDetails.id) {
    let selectedRow = document.querySelector('.route-info-table tbody tr');
    if (!selectedRow) {
      document.querySelectorAll(`.route-info-table[data-route-index="${routeIndex}"] tbody tr`).forEach(row => {
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
  pathDrawing.clearLines();
  const iataCodes = route.map(r => r.flyFrom).concat(route[route.length - 1].flyTo);
  for (let i = 0; i < iataCodes.length - 1; i++) {
      const originIata = iataCodes[i];
      const destinationIata = iataCodes[i + 1];
      pathDrawing.drawPathBetweenAirports(originIata, destinationIata, flightMap.getAirportDataByIata);
  }
}

function replaceWaypointsForCurrentRoute(intermediaryIatas, routeIndex) {
  // Adjust startIndex for round trips to ensure the entire waypoints array is considered
  const startIndex = appState.roundTrip ? 0 : routeIndex * 2;
  let before = appState.waypoints.slice(0, startIndex);
  let after = appState.roundTrip ? [] : appState.waypoints.slice((routeIndex + 1) * 2);

  let updatedSegment = [flightMap.airportDataCache[intermediaryIatas[0]]];

  for (let i = 1; i < intermediaryIatas.length; i++) {
      let airportData = flightMap.airportDataCache[intermediaryIatas[i]];
      updatedSegment.push(airportData);
      if (i < intermediaryIatas.length - 1) {
          updatedSegment.push(airportData);
      }
  }

  // For round trips, ensure the return to the origin is explicitly handled
  if (appState.roundTrip) {
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

export { routeInfoRow, highlightSelectedRowForRouteIndex };

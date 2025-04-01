import { appState, updateState } from "../stateManager.js";
import { initDatePicker } from "./datePicker.js";
import { uiHandling } from "../uiHandling.js";

export function tripTypePicker(routeNumber) {
    const tripTypeContainer = document.createElement('div');
    tripTypeContainer.className = 'trip-type-container';

    if (!appState.routes[routeNumber]) {
        appState.routes[routeNumber] = { tripType: 'oneWay' };
    }
    const tripType = appState.routes[routeNumber].tripType;

    const dropdownBtn = document.createElement('button');
    dropdownBtn.id = 'tripTypeDropdownBtn';
    dropdownBtn.className = 'trip-type-dropdown-btn';
    dropdownBtn.innerHTML = `${tripType.charAt(0).toUpperCase() + tripType.slice(1)} <span class="icon-dropdown"></span>`;
    tripTypeContainer.appendChild(dropdownBtn);

    const dropdownList = document.createElement('ul');
    dropdownList.id = 'tripTypeDropdown';
    dropdownList.className = 'trip-type-dropdown hidden';
    const tripTypes = ['Round trip', 'One way', 'Nomad'];
    const tripTypeValues = ['roundTrip', 'oneWay', 'nomad'];

    dropdownBtn.addEventListener('click', () => {
        dropdownList.classList.toggle('hidden');
        if (!dropdownList.classList.contains('hidden')) {
            uiHandling.positionDropdown(dropdownBtn, dropdownList);
        }
    });

    window.addEventListener('scroll', () => {
        if (!dropdownList.classList.contains('hidden')) {
            uiHandling.positionDropdown(dropdownBtn, dropdownList);
        }
    });

    window.addEventListener('resize', () => {
        if (!dropdownList.classList.contains('hidden')) {
            uiHandling.positionDropdown(dropdownBtn, dropdownList);
        }
    });

    tripTypes.forEach((type, index) => {
        const listItem = document.createElement('li');
        listItem.textContent = type;
        listItem.addEventListener('click', () => {
            if (!appState.routes[routeNumber]) {
                appState.routes[routeNumber] = {};
            }
            appState.routes[routeNumber].tripType = tripTypeValues[index];
            dropdownBtn.innerHTML = `${type} <span class="icon-dropdown"></span>`;
            dropdownList.classList.add('hidden');
            updateState('tripType', { routeNumber, tripType: tripTypeValues[index] }, 'tripTypePicker.tripTypePicker');
            handleTripTypeChange(tripTypeValues[index], routeNumber);
            document.dispatchEvent(new CustomEvent('stateChange', { detail: { key: 'tripType', value: tripTypeValues[index] } }));
        });
        dropdownList.appendChild(listItem);
    });

    tripTypeContainer.appendChild(dropdownList);

    // Add event listener to close the dropdown when clicking outside
    document.addEventListener('click', function (event) {
        if (!tripTypeContainer.contains(event.target)) {
            dropdownList.classList.add('hidden');
        }
    });

    return tripTypeContainer;
}

export function handleTripTypeChange(tripType, routeNumber) {
    // Get the route data for this route number
    const routeData = appState.routeData[routeNumber] || {};
    
    // Update the routes array with the new trip type
    updateState('tripType', { routeNumber: routeNumber, tripType: tripType }, 'tripTypePicker.handleTripTypeChange');
    
    // Check if origin is set to "Anywhere" - only use routeData
    const isOriginAny = routeData.origin?.iata_code === 'Any' || 
                        routeData.origin?.isAnyOrigin;
    
    // Check if destination is set to "Anywhere" - only use routeData
    const isDestinationAny = routeData.destination?.iata_code === 'Any' || 
                            routeData.destination?.isAnyDestination;
    
    // If both are "Anywhere", clear origin to prevent invalid state
    if (isOriginAny && isDestinationAny) {
        // Update routeData directly
        updateState('updateRouteData', {
            routeNumber: routeNumber,
            data: { origin: null }
        }, 'tripTypePicker.handleTripTypeChange.preventDualAny');
        
        // Update the DOM
        const fromInput = document.getElementById(`waypoint-input-${routeNumber * 2 + 1}`);
        if (fromInput) {
            fromInput.value = '';
            fromInput.removeAttribute('data-selected-iata');
            fromInput.removeAttribute('data-is-any-destination');
        }
        
        // Preserve only the destination as "Anywhere"
        window.preserveAnyDestination = true;
        setTimeout(() => {
            window.preserveAnyDestination = false;
        }, 500);
    }
    // If either origin or destination is "Anywhere" (but not both), preserve it
    else if (isOriginAny || isDestinationAny) {
        window.preserveAnyDestination = true;
        setTimeout(() => {
            window.preserveAnyDestination = false;
        }, 500);
    }
    
    // Rest of your code for handling trip type changes...
    const dateInputsContainer = document.querySelector('.date-inputs-container');
    if (dateInputsContainer) {
        dateInputsContainer.innerHTML = '';
        if (tripType === 'oneWay') {
            const dateInput = createDateInput('depart', routeNumber);
            dateInput.classList.add('full-width');
            dateInputsContainer.appendChild(dateInput);
            initDatePicker('depart-date-input', routeNumber);
            delete appState.routeDates[routeNumber].return;
        } else {
            const departDateInput = createDateInput('depart', routeNumber);
            const returnDateInput = createDateInput('return', routeNumber);
            const dateRow = document.createElement('div');
            dateRow.className = 'date-row';
            dateRow.appendChild(departDateInput);
            dateRow.appendChild(returnDateInput);
            dateInputsContainer.appendChild(dateRow);
            initDatePicker('depart-date-input', routeNumber);
            initDatePicker('return-date-input', routeNumber);
        }
    }
}

function createDateInput(dateType, routeNumber) {
    const dateInput = document.createElement('input');
    dateInput.id = `${dateType}-date-input`;
    dateInput.className = 'date-input form-control input';
    dateInput.type = 'text';
    dateInput.readOnly = true;
    dateInput.placeholder = `${dateType.charAt(0).toUpperCase() + dateType.slice(1)} Date`;
    const currentDate = new Date().toISOString().split('T')[0];
    const returnDate = new Date(new Date().getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    dateInput.value = appState.routeDates[routeNumber] ? appState.routeDates[routeNumber][dateType] : (dateType === 'depart' ? currentDate : returnDate);
    dateInput.name = `${dateType}-date-input`;
    return dateInput;
}

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

// This is a suggestion for an update to handle "Anywhere" values properly in trip type changes
// Note: I don't have access to this file directly so you'll need to adapt this to your codebase

export function handleTripTypeChange(tripType, routeNumber) {
    // Update your existing code to recognize "Anywhere" as a valid destination
    const fromInput = document.getElementById(`waypoint-input-${routeNumber * 2 + 1}`);
    const toInput = document.getElementById(`waypoint-input-${routeNumber * 2 + 2}`);
    
    // Update the routes array with the new trip type
    updateState('tripType', { routeNumber: routeNumber, tripType: tripType }, 'tripTypePicker.handleTripTypeChange');
    
    // Check if the destination is set to "Anywhere" and handle accordingly
    // This allows "Anywhere" to be a valid destination for any trip type
    if (toInput?.value === 'Anywhere' || 
        toInput?.getAttribute('data-is-any-destination') === 'true' ||
        (appState.waypoints[routeNumber * 2 + 1] && 
         (appState.waypoints[routeNumber * 2 + 1].iata_code === 'Any' || 
          appState.waypoints[routeNumber * 2 + 1].isAnyDestination === true))) {
        
        // If destination is "Anywhere", preserve it for any trip type
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

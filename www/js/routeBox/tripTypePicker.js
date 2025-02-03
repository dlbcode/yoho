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

    return tripTypeContainer;
}

export function handleTripTypeChange(tripType, routeNumber) {
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

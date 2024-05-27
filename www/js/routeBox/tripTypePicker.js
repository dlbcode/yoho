import { appState, updateState } from "../stateManager.js";
import { initDatePicker } from "./datePicker.js";

export function tripTypePicker(routeNumber) {
    const tripTypeContainer = document.createElement('div');
    tripTypeContainer.className = 'trip-type-container';

    // Create dropdown button
    const dropdownBtn = document.createElement('button');
    dropdownBtn.id = 'tripTypeDropdownBtn';
    dropdownBtn.className = 'trip-type-dropdown-btn';
    dropdownBtn.innerHTML = `${appState.tripType.charAt(0).toUpperCase() + appState.tripType.slice(1)} <span class="icon-dropdown"></span>`;
    tripTypeContainer.appendChild(dropdownBtn);

    // Create dropdown list
    const dropdownList = document.createElement('ul');
    dropdownList.id = 'tripTypeDropdown';
    dropdownList.className = 'trip-type-dropdown hidden';
    const tripTypes = ['Round trip', 'One way', 'Nomad'];
    const tripTypeValues = ['roundTrip', 'oneWay', 'nomad'];

    tripTypes.forEach((type, index) => {
        const listItem = document.createElement('li');
        listItem.textContent = type;
        listItem.addEventListener('click', () => {
            appState.tripType = tripTypeValues[index];
            dropdownBtn.innerHTML = `${type} <span class="icon-dropdown"></span>`;
            dropdownList.classList.add('hidden');
            updateState('tripType', tripTypeValues[index]);
            handleTripTypeChange(tripTypeValues[index], routeNumber);  // Ensure routeNumber is passed
            // Optionally dispatch a state change event if needed
            document.dispatchEvent(new CustomEvent('stateChange', { detail: { key: 'tripType', value: tripTypeValues[index] } }));
        });
        dropdownList.appendChild(listItem);
    });

    tripTypeContainer.appendChild(dropdownList);

    // Toggle dropdown visibility on button click
    dropdownBtn.addEventListener('click', function() {
        dropdownList.classList.toggle('hidden');
    });

    return tripTypeContainer;
}

export function handleTripTypeChange(tripType, routeNumber) {
    console.log('handleTripType routeNumber a:', routeNumber);
    const dateInputsContainer = document.querySelector('.date-inputs-container');
    if (dateInputsContainer) {
        dateInputsContainer.innerHTML = ''; // Clear existing date inputs
        if (tripType === 'oneWay') {
            const dateInput = createDateInput('departure', routeNumber);
            dateInput.classList.add('full-width'); // Apply full-width class
            dateInputsContainer.appendChild(dateInput);
            console.log('handleTripType routeNumber:', routeNumber);
            initDatePicker('departure-date-input', routeNumber);
            delete appState.routeDates.return; // Remove return date for one-way trips
        } else {
            const departureDateInput = createDateInput('departure', routeNumber);
            const returnDateInput = createDateInput('return', routeNumber + 1);
            const dateRow = document.createElement('div');
            dateRow.className = 'date-row';
            dateRow.appendChild(departureDateInput);
            dateRow.appendChild(returnDateInput);
            dateInputsContainer.appendChild(dateRow);
            console.log('handleTripType routeNumber:', routeNumber);
            initDatePicker('departure-date-input', routeNumber);
            console.log('handleTripType routeNumber+1:', routeNumber + 1);
            initDatePicker('return-date-input', routeNumber + 1);
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
    dateInput.value = appState.routeDates[routeNumber] || currentDate;
    dateInput.name = `${dateType}-date-input`;
    return dateInput;
}

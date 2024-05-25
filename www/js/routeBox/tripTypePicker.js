import { appState, updateState } from "../stateManager.js";

export function tripTypePicker() {
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
            handleTripTypeChange(tripTypeValues[index]);
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

export function handleTripTypeChange(tripType) {
    const dateInputsContainer = document.querySelector('.date-inputs-container');
    if (dateInputsContainer) {
        if (tripType === 'oneWay') {
            dateInputsContainer.innerHTML = ''; // Clear existing date inputs
            const dateInput = createDateInput('date');
            dateInputsContainer.appendChild(dateInput);
        } else {
            dateInputsContainer.innerHTML = ''; // Clear existing date inputs
            const departureDateInput = createDateInput('departure');
            const returnDateInput = createDateInput('return');
            dateInputsContainer.appendChild(departureDateInput);
            dateInputsContainer.appendChild(returnDateInput);
        }
    }
}

function createDateInput(dateType) {
    const dateInput = document.createElement('input');
    dateInput.id = `${dateType}-date-input`;
    dateInput.className = 'date-input form-control input';
    dateInput.type = 'text';
    dateInput.readOnly = true;
    dateInput.placeholder = `${dateType.charAt(0).toUpperCase() + dateType.slice(1)} Date`;
    const currentDate = new Date().toISOString().split('T')[0];
    dateInput.value = appState.routeDates[dateType] || currentDate;
    appState.routeDates[dateType] = dateInput.value;
    dateInput.name = `${dateType}-date-input`;
    dateInput.addEventListener('change', (e) => appState.routeDates[dateType] = e.target.value);
    return dateInput;
}

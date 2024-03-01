import { routeList } from './routeList.js';
import { appState, updateState } from './stateManager.js';

const leftPane = {
    flatpickrInstances: [], // Array to store Flatpickr instances

    init() {
        routeList.init();
        this.initDatePicker();
    },

    initDatePicker() {
        this.destroyFlatpickrInstances();
        document.getElementById('datePickerContainer').innerHTML = '';
    },   
    
    // Adjust the createDateInput function if necessary to accommodate the range selection
    createDateInput(id, placeholder, defaultValue = '') {
        const input = document.createElement('input');
        input.type = 'text';
        input.id = id;
        input.placeholder = placeholder;
        if (defaultValue) input.value = defaultValue; // Set default value if provided
        document.getElementById('datePickerContainer').appendChild(input);
    },
    
    initializeFlatpickr(inputElement, mode) {
        const config = {
            enableTime: false,
            dateFormat: "Y-m-d", // Format for the actual input value, used for appState
            altInput: false, // Disable alternative input display
            mode: mode, // 'range'
            onChange: (selectedDates) => {
                if (selectedDates.length === 2) { // Check if a range is selected
                    // Format dates for appState
                    const startDate = flatpickr.formatDate(selectedDates[0], "Y-m-d");
                    const endDate = flatpickr.formatDate(selectedDates[1], "Y-m-d");
    
                    // Update appState with the selected dates
                    updateState('startDate', startDate);
                    updateState('endDate', endDate);
    
                    // Manually update input fields for display in "D, M j Y" format
                    document.getElementById('startDateInput').value = flatpickr.formatDate(selectedDates[0], "D, M j Y");
                    document.getElementById('endDateInput').value = flatpickr.formatDate(selectedDates[1], "D, M j Y");
                }
            },
        };
    
        const instance = flatpickr(inputElement, config);
        this.flatpickrInstances.push(instance);
    },  

    destroyFlatpickrInstances() {
        this.flatpickrInstances.forEach(instance => instance.destroy());
        this.flatpickrInstances = [];
    },

    refreshFlatpickrInstances: function() {
        leftPane.flatpickrInstances.forEach((instance, index) => {
            const routeNumber = index + 1; // Assuming routeNumber corresponds to index + 1
            const newMinDate = routeNumber === 1 ? "today" : appState.routeDates[routeNumber - 1];
            instance.set('minDate', newMinDate);
        });
    }    
};

document.addEventListener('DOMContentLoaded', function() {
    leftPane.init();
});

document.addEventListener('appStateChange', function(event) {
    const { startDate, endDate } = event.detail;
    updateState('startDate', startDate);
    if (endDate !== undefined) { // Check for undefined because null is a valid reset value
        updateState('endDate', endDate);
    }
});

export { leftPane };

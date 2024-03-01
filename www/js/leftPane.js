import { routeList } from './routeList.js';
import { appState, updateState } from './stateManager.js';

const leftPane = {
    flatpickrInstances: [], // Array to store Flatpickr instances

    init() {
        routeList.init();
        this.initDatePicker();

        // Listen for state changes to update the date picker accordingly
        document.addEventListener('stateChange', (event) => {
            if (event.detail.key === 'oneWay') {
                this.initDatePicker();
            }
        });
    },

    initDatePicker() {
        // Clear existing date pickers
        this.destroyFlatpickrInstances();
        document.getElementById('datePickerContainer').innerHTML = ''; // Reset the container
    
        if (appState.oneWay) {
            document.getElementById('datePickerContainer').style.display = 'none';
        } else {
            document.getElementById('datePickerContainer').style.display = '';
            this.createDateInput('startDateInput', 'Start date', new Date().toISOString().split('T')[0]); // Use today's date as default
            this.createDateInput('endDateInput', 'End date'); // Placeholder "End date" is set in createDateInput function
    
            // Initialize flatpickr in range mode for startDateInput
            this.initializeFlatpickr(document.getElementById('startDateInput'), 'range', (date) => {
                // Callback function to handle date range selection
            });
    
            // Add click event listener to endDateInput to trigger startDateInput's Flatpickr
            document.getElementById('endDateInput').addEventListener('click', () => {
                document.getElementById('startDateInput')._flatpickr.open();
            });
        }
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
    
    initializeFlatpickr(inputElement, mode, onChangeCallback) {
        const config = {
            enableTime: false,
            dateFormat: "Y-m-d",
            mode: mode, // Ensure this is 'range' for the startDateInput
            onChange: function(selectedDates) {
                if (selectedDates.length === 2) { // Check if a range is selected
                    const startDate = this.formatDate(selectedDates[0], "D M d, Y");
                    const endDate = this.formatDate(selectedDates[1], "D M d, Y");
    
                    // Update the input values
                    document.getElementById('startDateInput').value = startDate;
                    document.getElementById('endDateInput').value = endDate;
    
                    // Optionally, update appState or perform other actions
                    updateState('startDate', startDate);
                    updateState('endDate', endDate);
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

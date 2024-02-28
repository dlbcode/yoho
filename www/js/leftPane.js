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
    
            // Initialize flatpickr for startDateInput
            this.initializeFlatpickr(document.getElementById('startDateInput'), 'single', (date) => {
                updateState('startDate', date);
            });
    
            // Initialize flatpickr for endDateInput without a default date
            this.initializeFlatpickr(document.getElementById('endDateInput'), 'single', (date) => {
                updateState('endDate', date);
            }, true); // The last parameter indicates that this is for the end date
        }
    },
    
    createDateInput(id, placeholder, defaultValue = '') {
        const input = document.createElement('input');
        input.type = 'text';
        input.id = id;
        input.placeholder = placeholder;
        if (defaultValue) input.value = defaultValue; // Set default value if provided
        document.getElementById('datePickerContainer').appendChild(input);
    },
    
    initializeFlatpickr(inputElement, mode, onChangeCallback, isEndDate = false) {
        const config = {
            enableTime: false,
            dateFormat: "Y-m-d",
            defaultDate: isEndDate ? null : new Date(appState.startDate), // Only set defaultDate for startDateInput
            minDate: "today",
            onChange: function(selectedDates) {
                if (selectedDates.length > 0) {
                    const formattedDate = this.formatDate(selectedDates[0], "Y-m-d");
                    onChangeCallback(formattedDate);
                }
            },
        };
    
        if (mode === 'range') {
            config.mode = 'range';
        }
    
        const instance = flatpickr(inputElement, config);
        this.flatpickrInstances.push(instance);
    },       

    destroyFlatpickrInstances() {
        this.flatpickrInstances.forEach(instance => instance.destroy());
        this.flatpickrInstances = [];
    },
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

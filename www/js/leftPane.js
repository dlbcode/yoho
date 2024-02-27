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
            // If oneWay is true, only create one input field
            this.createDateInput('flatpickrInput', 'Select date');
            this.initializeFlatpickr(document.getElementById('flatpickrInput'), 'single');
        } else {
            // If oneWay is false, create two input fields for start and end dates
            this.createDateInput('startDateInput', 'Start date');
            this.createDateInput('endDateInput', 'End date');
            this.initializeFlatpickr(document.getElementById('startDateInput'), 'range');
            this.initializeFlatpickr(document.getElementById('endDateInput'), 'range');
        }
    },

    createDateInput(id, placeholder) {
        const input = document.createElement('input');
        input.type = 'text';
        input.id = id;
        input.placeholder = placeholder;
        document.getElementById('datePickerContainer').appendChild(input);
    },

    initializeFlatpickr() {
        this.destroyFlatpickrInstances();
        document.getElementById('datePickerContainer').innerHTML = '';
    
        if (!appState.oneWay) {
            ['startDateInput', 'endDateInput'].forEach((id, index) => {
                const input = document.createElement('input');
                input.type = 'text';
                input.id = id;
                input.placeholder = index === 0 ? 'Start date' : 'End date';
                document.getElementById('datePickerContainer').appendChild(input);
    
                const fpInstance = flatpickr(input, {
                    enableTime: false,
                    dateFormat: "Y-m-d", // Internal format used for date handling
                    altInput: true, // Enable an alternative input that displays the date to the user
                    altFormat: "D, M d Y", // Format for the alternative input (display format)
                    defaultDate: index === 0 ? appState.startDate : appState.endDate || appState.startDate,
                    minDate: "today",
                    onChange: (selectedDates) => {
                        const dateKey = index === 0 ? 'startDate' : 'endDate';
                        // Update the app state with the selected date in "Y-m-d" format
                        updateState(dateKey, selectedDates[0].toISOString().split('T')[0]);
                        if (index === 0 && !appState.endDate) {
                            // Ensure the endDate picker's minDate is updated based on the startDate selection
                            const endDatePicker = document.getElementById('endDateInput')._flatpickr;
                            if (endDatePicker) {
                                endDatePicker.set('minDate', selectedDates[0]);
                            }
                        }
                    }
                });
                this.flatpickrInstances.push(fpInstance);
            });
        }
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

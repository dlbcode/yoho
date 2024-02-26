import { routeList } from './routeList.js';
import { appState } from './stateManager.js';

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

    initializeFlatpickr(inputElement, mode) {
        const instance = flatpickr(inputElement, {
            mode: mode,
            enableTime: false,
            dateFormat: "D, M d Y",
            onChange: function(selectedDates, dateStr, instance) {
                if (mode === 'range' && selectedDates.length === 2) {
                    // Update the start and end date inputs separately
                    const [start, end] = selectedDates;
                    document.getElementById('startDateInput').value = instance.formatDate(start, "D, M d Y");
                    document.getElementById('endDateInput').value = instance.formatDate(end, "D, M d Y");
                }
            },
        });
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

export { leftPane };

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
            // If oneWay is true, do not display the datePickerContainer at all
            document.getElementById('datePickerContainer').style.display = 'none';
        } else {
            // If oneWay is false, proceed as before
            document.getElementById('datePickerContainer').style.display = ''; // Make sure to reset display property
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
        const startDate = new Date(appState.startDate);
        const instance = flatpickr(inputElement, {
            mode: mode,
            enableTime: false,
            dateFormat: "D, M d Y",
            defaultDate: startDate,
            minDate: startDate,
            onChange: function(selectedDates, dateStr, instance) {
                if (selectedDates.length > 0) {
                    updateState('startDate', instance.formatDate(selectedDates[0], "Y-m-d"));
                    if (mode === 'range' && selectedDates.length === 2) {
                        const [start, end] = selectedDates;
                        document.getElementById('startDateInput').value = instance.formatDate(start, "D, M d Y");
                        document.getElementById('endDateInput').value = instance.formatDate(end, "D, M d Y");
                        updateState('startDate', instance.formatDate(selectedDates[0], "Y-m-d"));
                        if (!appState.oneWay && selectedDates.length === 2) {
                            updateState('endDate', instance.formatDate(selectedDates[1], "Y-m-d"));
                        } else if (!appState.oneWay) {
                            updateState('endDate', null);
                        }
                    }
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

document.addEventListener('appStateChange', function(event) {
    const { startDate, endDate } = event.detail;
    updateState('startDate', startDate);
    if (endDate !== undefined) { // Check for undefined because null is a valid reset value
        updateState('endDate', endDate);
    }
});

export { leftPane };

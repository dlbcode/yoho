import { routeList } from './routeList.js';
import { appState } from './stateManager.js';

const leftPane = {
    flatpickrInstance: null, // Store the Flatpickr instance

    init() {
        routeList.init();
        this.initDatePicker();
    },

    initDatePicker() {
        // Check if the input already exists to avoid creating a new one
        let dateInput = document.getElementById('flatpickrInput');
        if (!dateInput) {
            dateInput = document.createElement('input');
            dateInput.setAttribute('type', 'text');
            dateInput.setAttribute('id', 'flatpickrInput');
            dateInput.setAttribute('placeholder', 'Select date');
            document.getElementById('datePickerContainer').appendChild(dateInput);
        }

        this.updateDatePicker();
        
        // Listen for state changes to update the date picker accordingly
        document.addEventListener('stateChange', (event) => {
            if (event.detail.key === 'oneWay') {
                this.updateDatePicker();
            }
        });
    },

    updateDatePicker() {
        // Destroy the previous instance if it exists
        if (this.flatpickrInstance) {
            this.flatpickrInstance.destroy();
        }
    
        const dateInput = document.getElementById('flatpickrInput');
        // Initialize Flatpickr based on the appState.oneWay
        this.flatpickrInstance = flatpickr(dateInput, {
            mode: appState.oneWay ? 'single' : 'range',
            enableTime: false,
            dateFormat: "D, M d Y", // Updated date format to "Mon, Feb 21 2024"
            onChange: function(selectedDates, dateStr, instance) {
                // Handle the date or date range selection
                console.log(dateStr);
            },
        });
    },          
};

document.addEventListener('DOMContentLoaded', function() {
    leftPane.init();
});

export { leftPane };

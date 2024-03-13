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

import { routeList } from './routeList.js';
import { appState } from './stateManager.js';

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
            const routeNumber = index;
            const newMinDate = routeNumber === 0 ? "today" : appState.routeDates[routeNumber - 1];
            instance.set('minDate', newMinDate);
        });
    }    
};

document.addEventListener('DOMContentLoaded', function() {
    leftPane.init();
});

export { leftPane };

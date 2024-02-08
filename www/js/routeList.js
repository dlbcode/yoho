import { appState } from './stateManager.js';

const routeList = {

    init() {
        this.initTravelersDropdown();
        this.addStateChangeListener();
    },

    initTravelersDropdown: function() {
        const travelersDropdown = document.getElementById('travelersDropdown');
        travelersDropdown.addEventListener('change', (event) => {
            appState.numTravelers = parseInt(event.target.value, 10);
            this.updateTotalCost();
        });
    },

    updateTotalCost: function() {
        let totalCost = 0;
        appState.routes.forEach(route => {
            totalCost += route.price;
        });

        // Double the cost if the trip is not one-way
        if (!appState.oneWay) {
            totalCost *= 2;
        }

        totalCost *= appState.numTravelers;
        document.getElementById('totalCost').innerHTML = `Estimated: <span style="color: #fff;">$${totalCost.toFixed(2)}</span>`;
    },

    addStateChangeListener() {
        document.addEventListener('stateChange', (event) => {
            if (event.detail.key === 'oneWay' || event.detail.key === 'numTravelers' || event.detail.key === 'routes') {
                this.updateTotalCost();
            }
        });
    }
};

routeList.init();

export { routeList };

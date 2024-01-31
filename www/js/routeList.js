import { appState } from './stateManager.js';

const routeList = {

    numTravelers: 1,

    init() {
        this.initTravelerControls();
        this.addStateChangeListener();
    },

    initTravelerControls() {
        ['increaseTravelers', 'decreaseTravelers'].forEach(id =>
            document.getElementById(id).addEventListener('click', () => this.updateTravelers(id)));
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

        totalCost *= this.numTravelers;
        document.getElementById('totalCost').textContent = `Total Trip Cost: $${totalCost.toFixed(2)}`;
        document.getElementById('numTravelers').value = this.numTravelers;
    },

    updateTravelers(id) {
        if (id === 'increaseTravelers') {
            this.numTravelers++;
        } else if (this.numTravelers > 1) {
            this.numTravelers--;
        }
        this.updateTotalCost();
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

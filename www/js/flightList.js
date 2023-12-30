import { appState, updateState } from './stateManager.js';

const flightList = {

    numTravelers: 1,

    initTravelerControls() {
        ['increaseTravelers', 'decreaseTravelers'].forEach(id =>
            document.getElementById(id).addEventListener('click', () => this.updateTravelers(id)));
    },

    updateTotalCost: function() {
        let totalCost = 0;
        appState.flights.forEach(flight => {
            totalCost += flight.price;
        });
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
    }
};

export { flightList };

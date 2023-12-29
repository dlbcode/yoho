import { appState, updateState } from './stateManager.js';

const flightList = {

    numTravelers: 1,

    initTravelerControls() {
        ['increaseTravelers', 'decreaseTravelers'].forEach(id =>
            document.getElementById(id).addEventListener('click', () => this.updateTravelers(id)));
    },

    updateTotalCost: function() {
        var totalCost = 0;
        var listItems = document.getElementById('flightDetailsList').children;
        for (let i = 0; i < listItems.length; i++) {
            var cost = parseFloat(listItems[i].getAttribute('data-price'));
            if (!isNaN(cost)) {
                totalCost += cost;
            }
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
    }
};

export { flightList };

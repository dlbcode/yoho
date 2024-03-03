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
            this.updateEstPrice();
        });
    },

    updateEstPrice: function() {
        let estPrice = 0;
        appState.routes.forEach(route => {
            estPrice += route.price;
        });

        estPrice *= appState.numTravelers;
        document.getElementById('estPriceValue').innerHTML = `$${estPrice.toFixed(2)}`;
    },

    addStateChangeListener() {
        document.addEventListener('stateChange', (event) => {
            if (event.detail.key === 'numTravelers' || event.detail.key === 'routes') {
                this.updateEstPrice();
            }
        });
    }
};

routeList.init();

export { routeList };

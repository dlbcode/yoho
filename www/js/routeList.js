import { appState } from './stateManager.js';

const routeList = {

    init() {
        this.addStateChangeListener();
    },

    updateEstPrice: function() {
        let estPrice = 0;
        appState.routes.forEach(route => {
            estPrice += route.price;
        });
    
        estPrice = Math.round(estPrice * appState.numTravelers);
        const estPriceElement = document.getElementById('estPrice');
        const estPriceValueElement = document.getElementById('estPriceValue');
        
        if (estPrice > 0) {
            estPriceValueElement.innerHTML = `$${estPrice}`;
            estPriceElement.style.display = 'flex'; // Make sure the box is visible if the price is greater than 0
        } else {
            estPriceElement.style.display = 'none'; // Hide the box if the price is 0
        }
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

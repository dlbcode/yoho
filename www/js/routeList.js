import { appState } from './stateManager.js';

const routeList = {

    init() {
        this.addStateChangeListener();
    },

    updateEstPrice() {
        const totalPrice = appState.routeData
            .filter(route => route && !route.isEmpty && route.price)
            .reduce((sum, route) => sum + route.price, 0);
    
        const estPrice = Math.round(totalPrice * appState.numTravelers);
        const estPriceElement = document.getElementById('estPrice');
        const estPriceValueElement = document.getElementById('estPriceValue');
        
        if (estPrice > 0) {
            estPriceValueElement.innerHTML = `$${estPrice}`;
            estPriceElement.style.display = 'flex';
        } else {
            estPriceElement.style.display = 'none';
        }
    },    

    addStateChangeListener() {
        document.addEventListener('stateChange', (event) => {
            if (event.detail.key === 'numTravelers' || 
                event.detail.key === 'updateRouteData' || 
                event.detail.key === 'removeRoute') {
                this.updateEstPrice();
            }
        });
    }
};

routeList.init();

export { routeList };

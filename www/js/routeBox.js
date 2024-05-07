import { appState } from './stateManager.js';
import { routeHandling } from './routeHandling.js';

const routeBox = { 
    showRouteBox: function(plusButton) {
        if (!document.getElementById('routeBox')) {
            let routeBox = document.createElement('div');
            routeBox.id = 'routeBox';
            routeBox.style.width = '300px';
            routeBox.style.height = '200px';
            routeBox.style.position = 'absolute';
            routeBox.style.backgroundColor = '#FFF'; // Example background color
            routeBox.style.top = '0'; // Adjust based on actual needs
            routeBox.style.left = '0'; // Adjust based on actual needs
            menuBar.insertBefore(routeBox, plusButton);
        }
    }
}

export { routeBox };

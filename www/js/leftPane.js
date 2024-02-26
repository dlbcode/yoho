// Import routeList module
import { routeList } from './routeList.js';

const leftPane = {
    init() {
        routeList.init();
    },

    // Additional methods for leftPane can go here
};

document.addEventListener('DOMContentLoaded', () => {
    leftPane.init();
});

export { leftPane };

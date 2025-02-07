export const domManager = {
    setupBaseStructure(routeIndex) {
        const infoPaneContent = document.getElementById('infoPaneContent');
        infoPaneContent.innerHTML = '';

        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'content-wrapper';

        const routeBoxContainer = document.createElement('div');
        routeBoxContainer.id = 'routeBoxContainer';

        const routeBoxElement = routeBox.createRouteBox();
        routeBoxElement.id = 'routeBox';
        routeBoxElement.dataset.routeNumber = routeIndex;

        routeBoxContainer.appendChild(routeBoxElement);
        contentWrapper.appendChild(routeBoxContainer);
        infoPaneContent.appendChild(contentWrapper);

        routeBox.setupRouteBox(routeBoxElement, routeIndex);

        return { contentWrapper, routeBoxContainer, routeBoxElement };
    },

    clearRouteBox() {
        const existingRouteBox = document.getElementById('routeBox');
        if (existingRouteBox) {
            existingRouteBox.remove();
        }
    },

    preserveRouteBox(contentWrapper) {
        const existingRouteBox = contentWrapper.querySelector('#routeBox');
        contentWrapper.innerHTML = '';
        if (existingRouteBox) {
            contentWrapper.appendChild(existingRouteBox);
        }
        return existingRouteBox;
    },

    removeRouteStructure(routeNumber) {
        const routeBox = document.getElementById('routeBox');
        const routeBoxContainer = document.getElementById('routeBoxContainer');
        const contentWrapper = document.querySelector('.content-wrapper');

        if (routeBox) routeBox.remove();
        if (routeBoxContainer) routeBoxContainer.remove();
        if (contentWrapper) contentWrapper.remove();
    }
};
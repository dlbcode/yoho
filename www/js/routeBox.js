import { appState } from './stateManager.js';
import { setupAutocompleteForField } from './airportAutocomplete.js';

// link and load the routeBox.css file
const link = document.createElement('link');
link.rel = 'stylesheet';
link.href = 'css/routeBox.css';
document.head.appendChild(link);

// In routeBox.js
const routeBox = {
    showRouteBox: function(event, routeIndex) {
        console.log('showRouteBox', routeIndex);
        let existingRouteBox = document.getElementById('routeBox');
        if (existingRouteBox) {
            existingRouteBox.remove();
        }

        let routeBox = document.createElement('div');
        routeBox.id = 'routeBox';
        routeBox.className = 'route-box-popup';
        document.body.appendChild(routeBox);

        let placeholders = ['From', 'To'];

        let waypointsOrder = appState.routeDirection === 'to' ? [1, 0] : [0, 1];
    
        for (let i = 0; i < 2; i++) {
            let index = (routeIndex) * 2 + waypointsOrder[i];
            let waypoint = appState.waypoints[index];
            let input = document.createElement('input');
            input.type = 'text';
            input.id = `waypoint-input-${index + 1}`;

            input.placeholder = placeholders[i];
            input.value = waypoint ? waypoint.iata_code : '';
    
            input.addEventListener('mouseover', async function() {
                const iataCode = this.value.match(/\b([A-Z]{3})\b/); // Extract IATA code using regex
                if (iataCode) {
                    const airportInfo = await fetchAirportByIata(iataCode[1]);
                    if (airportInfo) {
                        routeHandling.showWaypointTooltip(this, `${airportInfo.name} (${airportInfo.iata_code}) ${airportInfo.city}, ${airportInfo.country}`);
                    }
                }
            });

            routeBox.appendChild(input);
    
            const suggestionsDiv = document.createElement('div');
            suggestionsDiv.id = `waypoint-input-${index + 1}Suggestions`;
            suggestionsDiv.className = 'suggestions';
            routeBox.appendChild(suggestionsDiv);
        }

        for (let i = 0; i < 2; i++) {
            let index = (routeIndex) * 2 + i;
            console.log('setting up autocomplete for waypoint', index + 1);
            setupAutocompleteForField(`waypoint-input-${index + 1}`);
        }

        const closeButton = document.createElement('span');
        closeButton.innerHTML = '✕';
        closeButton.className = 'popup-close-button';
        closeButton.onclick = () => routeBox.style.display = 'none';
        routeBox.appendChild(closeButton);

        this.positionPopup(routeBox, event);
        routeBox.style.display = 'block';
    },

    createRouteDiv: function(routeIndex) {
        let routeDiv = document.createElement('div');
        routeDiv.className = 'route-container';

        // Simulating input creation for "From" and "To" fields
        ['From', 'To'].forEach((placeholder, index) => {
            let input = document.createElement('input');
            input.type = 'text';
            input.placeholder = placeholder;
            input.id = `waypoint-input-${routeIndex + index}`;
            routeDiv.appendChild(input);

            // Additional UI, such as suggestion boxes or other interactive elements, can be added here
        });

        // Optionally, add other UI elements like date pickers, buttons, etc.
        return routeDiv;
    },

    positionPopup: function(popup, event) {
        const iconRect = event.target.getBoundingClientRect();
        const popupWidth = popup.offsetWidth;
        const screenPadding = 10;

        let leftPosition = iconRect.left + window.scrollX - (popupWidth / 2) + (iconRect.width / 2);
        if (leftPosition + popupWidth > window.innerWidth - screenPadding) {
            leftPosition = window.innerWidth - popupWidth - screenPadding;
        } else if (leftPosition < screenPadding) {
            leftPosition = screenPadding;
        }

        popup.style.left = `${leftPosition}px`;
        popup.style.top = `${iconRect.top + window.scrollY - popup.offsetHeight - 10}px`; // Position above the icon
    }
}

export { routeBox };
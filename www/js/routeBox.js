import { appState, updateState } from './stateManager.js';
import { setupAutocompleteForField, fetchAirportByIata } from './airportAutocomplete.js';
import { buildRouteTable } from './routeTable/routeTable.js';

// link and load the routeBox.css file
const link = document.createElement('link');
link.rel = 'stylesheet';
link.href = 'css/routeBox.css';
document.head.appendChild(link);

// In routeBox.js
// Create header for close button alignment
const header = document.createElement('div');
header.className = 'route-box-header';

const closeButton = document.createElement('span');
closeButton.innerHTML = '✕';
closeButton.className = 'popup-close-button';
closeButton.onclick = () => routeBox.style.display = 'none';
header.appendChild(closeButton);

routeBox.appendChild(header);
routeBox.appendChild(tripTypeSelectWrapper);

// Waypoints inputs
for (let i = 0; i < 2; i++) {
    let index = (routeNumber) * 2 + i;
    setupAutocompleteForField(`waypoint-input-${index + 1}`);
}

routeBox.appendChild(dateInput);

const footer = document.createElement('div');
footer.className = 'route-box-footer';
const searchButton = document.createElement('button');
searchButton.textContent = 'Search';
searchButton.className = 'search-button';
searchButton.onclick = () => {
    updateState('currentView', 'routeTable');
    buildRouteTable(routeNumber);
}
footer.appendChild(searchButton);
routeBox.appendChild(footer);

this.positionPopup(routeBox, event);
routeBox.style.display = 'block';
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

let tooltipTimeout;

function showWaypointTooltip(element, text) {
    clearTimeout(tooltipTimeout);

    tooltipTimeout = setTimeout(() => {
        const tooltip = document.createElement('div');
        tooltip.className = 'waypointTooltip';
        tooltip.textContent = text;
        document.body.appendChild(tooltip);

        const rect = element.getBoundingClientRect();
        const containerRect = document.querySelector('.container').getBoundingClientRect();

        tooltip.style.position = 'absolute';
        tooltip.style.left = `${rect.left - containerRect.left}px`;
        tooltip.style.top = `${rect.bottom - containerRect.top}px`;
    }, 200);
}

export { routeBox };

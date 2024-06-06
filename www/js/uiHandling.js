import { appState, updateState } from "./stateManager.js";
import { adjustMapSize } from "./map.js";

const uiHandling = {

  setFocusToNextUnsetInput: function() {
    const waypointInputs = document.querySelectorAll('.waypoint-input[type="text"]');
    requestAnimationFrame(() => {
        for (let input of waypointInputs) {
            if (!input.value) {
                input.focus();
                break;
            }
        }
    });
  },

  initInfoPaneDragButton: function() {
    const infoPane = document.getElementById('infoPane');
    const resizeHandle = document.getElementById('resizeHandle');

    let startY, startHeight;

    const startDrag = function(e) {
      if (e.cancelable) {
        e.preventDefault();
      }

        // Use touch events if available, otherwise use mouse event
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        startY = clientY;
        startHeight = parseInt(document.defaultView.getComputedStyle(infoPane).height, 10);

        // Add event listeners for both mouse and touch move/end events
        document.documentElement.addEventListener('mousemove', doDrag, false);
        document.documentElement.addEventListener('mouseup', stopDrag, false);
        document.documentElement.addEventListener('touchmove', doDrag, { passive: false });
        document.documentElement.addEventListener('touchend', stopDrag, false);
    };

    const doDrag = function(e) {
      if (e.cancelable) {
        e.preventDefault();
      }

        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const newHeight = startHeight - (clientY - startY);
        const maxHeight = window.innerHeight; // Adjust to leave space for OS menu
        infoPane.style.height = `${Math.min(Math.max(80, newHeight), maxHeight)}px`;
        requestAnimationFrame(adjustMapSize);
    };

    const stopDrag = function() {
        document.documentElement.removeEventListener('mousemove', doDrag, false);
        document.documentElement.removeEventListener('mouseup', stopDrag, false);
        document.documentElement.removeEventListener('touchmove', doDrag, false);
        document.documentElement.removeEventListener('touchend', stopDrag, false);
    };

    resizeHandle.addEventListener('mousedown', startDrag, false);
    resizeHandle.addEventListener('touchstart', startDrag, { passive: false });
  },

  attachDateTooltip: function(element, routeNumber) {
    let tooltipTimeout;
    element.addEventListener('mouseover', function() {
        const selectedRoute = appState.selectedRoutes[routeNumber];
        if (selectedRoute && selectedRoute.displayData) {
            const { departure, arrival } = selectedRoute.displayData;
            const departureDate = new Date(departure);
            const arrivalDate = new Date(arrival);
            const options = { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true };
            const formattedDeparture = departureDate.toLocaleString('en-US', options);
            const formattedArrival = arrivalDate.toLocaleString('en-US', options);
            const tooltipText = `${formattedDeparture} to ${formattedArrival}`;
            uiHandling.showDateTooltip(this, tooltipText);
        } else {
            const routeDate = appState.routeDates[routeNumber];
            if (routeDate) {
                uiHandling.showDateTooltip(this, routeDate);
            }
        }
        // Set a timeout to hide the tooltip after 2000ms
        tooltipTimeout = setTimeout(uiHandling.hideDateTooltip, 2000);
    });
    element.addEventListener('mouseout', function() {
        // Clear the timeout when the mouse leaves the element
        clearTimeout(tooltipTimeout);
        uiHandling.hideDateTooltip();
    });
  },

  showDateTooltip: function(element, text) {
      clearTimeout(this.tooltipTimeout);
      this.tooltipTimeout = setTimeout(() => {
          const tooltip = document.createElement('div');
          tooltip.className = 'dateTooltip';
          tooltip.textContent = text;
          document.body.appendChild(tooltip);
          const rect = element.getBoundingClientRect();
          const containerRect = document.querySelector('.container').getBoundingClientRect();
          tooltip.style.position = 'absolute';
          tooltip.style.left = `${rect.left - containerRect.left}px`;
          tooltip.style.top = `${rect.bottom - containerRect.top}px`;
      }, 300);
  },

  hideDateTooltip: function() {
      clearTimeout(this.tooltipTimeout);
      document.querySelectorAll('.dateTooltip').forEach(tooltip => {
          tooltip.remove();
      });
  },
}

document.addEventListener('DOMContentLoaded', () => {
  uiHandling.initInfoPaneDragButton();
});

export { uiHandling }

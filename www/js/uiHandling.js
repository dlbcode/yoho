import { appState, updateState } from "./stateManager.js";
import { adjustMapSize } from "./map.js";

const uiHandling = {

  initTravelersDropdown: function() {
    if (this.travelersDropdownInitialized) return; // Prevent multiple initializations
    this.travelersDropdownInitialized = true;

    const dropdownBtn = document.getElementById('travelersDropdownBtn');
    const dropdown = document.getElementById('travelersDropdown');

    dropdownBtn.addEventListener('click', function() {
        dropdown.classList.toggle('hidden');
    });

    dropdown.addEventListener('click', function(event) {
        const item = event.target.closest('li');
        if (item) {
            const numTravelersText = item.textContent.match(/\d+/)[0];
            const numTravelers = parseInt(numTravelersText, 10);
            document.getElementById('travelersDropdownBtn').innerHTML = `<img src="assets/person.svg" alt="" class="icon-person"> ${numTravelersText} <span class="icon-dropdown"></span>`;
            dropdown.classList.add('hidden');
            updateState('numTravelers', numTravelers);
        }
    });
  },  

  hideDropdowns: function() {
    document.addEventListener('click', function(event) {
        const dropdownSelectors = ['#travelersDropdown', '#tripTypeDropdown'];
        dropdownSelectors.forEach(selector => {
            const dropdown = document.getElementById(selector.substring(1));
            const dropdownBtn = document.querySelector(`${selector}Btn`);
            if (dropdown && !dropdown.contains(event.target) && !dropdownBtn.contains(event.target)) {
                dropdown.classList.add('hidden');
            }
        });
    });
  },

  handleStateChange: function(event) {
        this.updateTripTypeContainerVisibility();
  }, 

  initTripButtons: function() {
    const addButton = document.getElementById('addBtn');
    addButton.addEventListener('click', () => this.handleAddButtonClick());
    this.toggleTripButtonsVisibility(false);
  },

  toggleTripButtonsVisibility: function() {
    document.getElementById('tripButtons').style.display =
      appState.waypoints.length > 1 ? 'flex' : 'none';
      addBtn.focus();
  },

  handleAddButtonClick: function() {
    const lastWaypoint = appState.waypoints[appState.waypoints.length - 1];
    updateState('addWaypoint', lastWaypoint);
  },

  setFocusToNextUnsetInput: function() {
    const waypointInputs = document.querySelectorAll('.airport-selection input[type="text"]');
    requestAnimationFrame(() => {
        for (let input of waypointInputs) {
            if (!input.value) {
                input.focus();
                break;
            }
        }
    });
  },
  
  initTogglePaneButton: function() {
    const toggleBtn = document.getElementById('togglePaneBtn');
    const leftPane = document.querySelector('.leftPane');
    const mapPane = document.querySelector('.mapPane');

    toggleBtn.addEventListener('click', () => {
        leftPane.classList.toggle('leftPane-hidden');
        mapPane.classList.toggle('mapPane-expanded');
        adjustMapSize();

        if (leftPane.classList.contains('leftPane-hidden')) {
            toggleBtn.style.left = '0px';
            toggleBtn.textContent = '❯';
        } else {
            toggleBtn.style.left = '180px';
            toggleBtn.textContent = '❮';
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
        infoPane.style.height = `${newHeight}px`;
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

  getPriceButton: function () {
    if (appState.waypoints.length === 2) {
        document.getElementById('getPriceBtn').classList.remove('hidden');
    } else {
        document.getElementById('getPriceBtn').classList.add('hidden');
    }
  },

  attachDateTooltip: function(element, routeNumber) {
    element.addEventListener('mouseover', function() {
      const selectedRoute = appState.selectedRoutes[routeNumber];
      if (selectedRoute && selectedRoute.displayData) {
          const { departure, arrival } = selectedRoute.displayData;
          // Format the departure and arrival times
          const departureDate = new Date(departure);
          const arrivalDate = new Date(arrival);
          const options = { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true };
          const formattedDeparture = departureDate.toLocaleString('en-US', options);
          const formattedArrival = arrivalDate.toLocaleString('en-US', options);
          const tooltipText = `${formattedDeparture} to ${formattedArrival}`;
          // Show tooltip with formatted date and time
          uiHandling.showDateTooltip(this, tooltipText);
      } else{
        const routeDate = appState.routeDates[routeNumber];
        if (routeDate) {
            uiHandling.showDateTooltip(this, routeDate);
        }
      }
    });
    element.addEventListener('mouseout', function() {
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
  }
}

document.addEventListener('DOMContentLoaded', () => {
  uiHandling.initTravelersDropdown();
  uiHandling.initTogglePaneButton();
  uiHandling.initInfoPaneDragButton();
  uiHandling.hideDropdowns();
  uiHandling.initTripButtons();
});

export { uiHandling }

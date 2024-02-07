import { appState, updateState } from "./stateManager.js";
import { adjustMapSize } from "./map.js";

const uiHandling = {

  initTripTypeButtons: function() {
    const oneWayButton = document.getElementById('oneWay');
    const roundTripButton = document.getElementById('roundTrip');

    document.addEventListener('routesArrayUpdated', this.handleStateChange.bind(this));
    
    oneWayButton.addEventListener('click', () => {
        updateState('oneWay', true);
        this.updateTripTypeButtonStyles();
    });

    roundTripButton.addEventListener('click', () => {
        updateState('oneWay', false);
        this.updateTripTypeButtonStyles();
    });
  },

  handleStateChange: function(event) {
        this.updateTripTypeContainerVisibility();
        this.updateTripTypeButtonStyles();
  },

  updateTripTypeButtonStyles: function() {
      const oneWayButton = document.getElementById('oneWay');
      const roundTripButton = document.getElementById('roundTrip');

      if (appState.oneWay === true) {
        oneWayButton.classList.add('active');  
        roundTripButton.classList.remove('active');
      } else {
          oneWayButton.classList.remove('active');
          roundTripButton.classList.add('active');
      }
  },

  updateTripTypeContainerVisibility: function() {
    const tripTypeContainer = document.querySelector('.trip-type-container');
    if (appState.routes.length > 1) {
        tripTypeContainer.style.display = 'none';
        updateState('oneWay', true);
    } else {
        tripTypeContainer.style.display = 'block';
    }
  },

  addAddButton: function() {
    const container = document.querySelector('.airport-selection');
    let addButton = document.createElement('button');
    addButton.textContent = 'Add';
    addButton.id = 'addRouteButton';
    addButton.addEventListener('click', this.handleAddButtonClick);
    container.appendChild(addButton);

    // Bring the 'Add' button into focus
    addButton.focus();
  },

  handleAddButtonClick: function() {
    // Duplicate the last waypoint and create a new route div
    const lastWaypoint = appState.waypoints[appState.waypoints.length - 1];
    updateState('addWaypoint', lastWaypoint);
    const newRouteNumber = Math.ceil(appState.waypoints.length / 2);
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

        // Check if leftPane is hidden and adjust toggle button position and text accordingly
        if (leftPane.classList.contains('leftPane-hidden')) {
            toggleBtn.style.left = '0px'; // Move button to the edge when leftPane is hidden
            toggleBtn.textContent = '❯'; // Right arrow when leftPane is hidden
        } else {
            toggleBtn.style.left = '170px'; // Original position when leftPane is visible
            toggleBtn.textContent = '❮';  // Left arrow when leftPane is visible
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

    // Attach the startDrag function to both mousedown and touchstart events
    resizeHandle.addEventListener('mousedown', startDrag, false);
    resizeHandle.addEventListener('touchstart', startDrag, { passive: false });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  uiHandling.initTripTypeButtons();
  uiHandling.initTogglePaneButton();
  uiHandling.initInfoPaneDragButton();
});


export { uiHandling }

import { appState, updateState } from "./stateManager.js";

const uiHandling = {

  initTripTypeButtons: function() {
    const oneWayButton = document.getElementById('oneWay');
    const roundTripButton = document.getElementById('roundTrip');

    oneWayButton.addEventListener('click', () => {
        updateState('roundTrip', false);
        this.updateButtonStyles();
    });

    roundTripButton.addEventListener('click', () => {
        updateState('roundTrip', true);
        this.updateButtonStyles();
    });

    this.updateButtonStyles(); // Call this to set initial styles
  },

  updateButtonStyles: function() {
      const oneWayButton = document.getElementById('oneWay');
      const roundTripButton = document.getElementById('roundTrip');

      if (appState.roundTrip) {
          roundTripButton.classList.add('active');
          oneWayButton.classList.remove('active');
      } else {
          roundTripButton.classList.remove('active');
          oneWayButton.classList.add('active');
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
  }
}

document.addEventListener('DOMContentLoaded', () => {
  uiHandling.initTripTypeButtons();
});

export { uiHandling }

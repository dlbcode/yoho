import { appState } from "../stateManager.js";
import { uiHandling } from '../uiHandling.js';

export function travelersPicker(routeNumber) {
  // Create travelers container if it doesn't exist
  const travelersContainer = document.createElement('div');
  travelersContainer.className = 'travelers-container';

  // Ensure the route exists and has a defined travelers value in routeData
  let travelersCount = appState.routeData[routeNumber]?.travelers || 1;
  if (travelersCount < 1) {
    travelersCount = 1;
  }
  if (travelersCount > 9) {
    travelersCount = 9;
  }

  const dropdownBtn = document.createElement('button');
  dropdownBtn.id = 'travelersDropdownBtn';
  dropdownBtn.className = 'travelers-dropdown-btn';
  dropdownBtn.innerHTML = `<img src="assets/person.svg" alt="" class="icon-person"> ${travelersCount} <span class="icon-dropdown"></span>`;
  travelersContainer.appendChild(dropdownBtn);

  const dropdownList = document.createElement('div');
  dropdownList.id = 'travelersDropdown';
  dropdownList.className = 'travelers-dropdown hidden';

  const decrementButton = document.createElement('button');
  decrementButton.textContent = '-';
  decrementButton.className = 'travelers-button';
  dropdownList.appendChild(decrementButton);

  const travelersCountDisplay = document.createElement('span');
  travelersCountDisplay.textContent = travelersCount;
  travelersCountDisplay.className = 'travelers-count-display';
  dropdownList.appendChild(travelersCountDisplay);

  const incrementButton = document.createElement('button');
  incrementButton.textContent = '+';
  incrementButton.className = 'travelers-button';
  dropdownList.appendChild(incrementButton);

  // Add event listeners
  decrementButton.addEventListener('click', () => {
    if (travelersCount > 1) {
      travelersCount--;
      updateTravelersDisplay();
      updateRouteData();
    }
  });

  incrementButton.addEventListener('click', () => {
    if (travelersCount < 9) {
      travelersCount++;
      updateTravelersDisplay();
      updateRouteData();
    }
  });

  dropdownBtn.addEventListener('click', () => {
    dropdownList.classList.toggle('hidden');
    if (!dropdownList.classList.contains('hidden')) {
      uiHandling.positionDropdown(dropdownBtn, dropdownList);
    }
  });

  // Add event listener to close dropdown when clicking outside
  document.addEventListener('click', function(event) {
    if (!travelersContainer.contains(event.target)) {
      dropdownList.classList.add('hidden');
    }
  });

  // Helper function to update travelers count in display
  function updateTravelersDisplay() {
    travelersCountDisplay.textContent = travelersCount;
    dropdownBtn.innerHTML = `<img src="assets/person.svg" alt="" class="icon-person"> ${travelersCount} <span class="icon-dropdown"></span>`;
  }

  // Helper function to update route data
  function updateRouteData() {
    import('../stateManager.js').then(({ updateState }) => {
      updateState('updateRouteData', {
        routeNumber,
        data: { travelers: travelersCount }
      }, 'travelersPicker.updateRouteData');
    });
  }

  travelersContainer.appendChild(dropdownList);
  return travelersContainer;
}

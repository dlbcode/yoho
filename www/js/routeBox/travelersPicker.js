import { appState, updateState } from "../stateManager.js";
import { uiHandling } from '../uiHandling.js';

export function travelersPicker(routeNumber) {
  const travelersContainer = document.createElement('div');
  travelersContainer.className = 'travelers-container';

  // Ensure the route exists and has a defined travelers value
  let travelersCount = appState.routes[routeNumber]?.travelers || 1;
  if (travelersCount < 1) {
    travelersCount = 1;
  }
  if (travelersCount > 10) {
    travelersCount = 10;
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

  dropdownBtn.addEventListener('click', () => {
    dropdownList.classList.toggle('hidden');
    if (!dropdownList.classList.contains('hidden')) {
      uiHandling.positionDropdown(dropdownBtn, dropdownList);
    }
  });

  // Update position on scroll/resize
  window.addEventListener('scroll', () => {
    if (!dropdownList.classList.contains('hidden')) {
      uiHandling.positionDropdown(dropdownBtn, dropdownList);
    }
  });

  window.addEventListener('resize', () => {
    if (!dropdownList.classList.contains('hidden')) {
      uiHandling.positionDropdown(dropdownBtn, dropdownList);
    }
  });

  decrementButton.addEventListener('click', () => {
    travelersCount = Math.max(1, travelersCount - 1);
    updateTravelersCount(travelersCount, routeNumber, dropdownBtn, travelersCountDisplay);
  });

  incrementButton.addEventListener('click', () => {
    travelersCount = Math.min(10, travelersCount + 1);
    updateTravelersCount(travelersCount, routeNumber, dropdownBtn, travelersCountDisplay);
  });

  travelersContainer.appendChild(dropdownList);

  // Add event listener to close the dropdown when clicking outside
  document.addEventListener('click', function (event) {
    if (!travelersContainer.contains(event.target)) {
      dropdownList.classList.add('hidden');
    }
  });

  return travelersContainer;  // Return the complete component
}

function updateTravelersCount(count, routeNumber, dropdownBtn, travelersCountDisplay) {
  travelersCountDisplay.textContent = count;
  dropdownBtn.innerHTML = `<img src="assets/person.svg" alt="" class="icon-person"> ${count} <span class="icon-dropdown"></span>`;
  updateState('updateTravelers', { routeNumber, travelers: count }, 'travelersPicker.travelersPicker');
}

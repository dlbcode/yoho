import { appState, updateState } from "../stateManager.js";
import { uiHandling } from '../uiHandling.js';

export function travelersPicker(routeNumber) {
  const travelersContainer = document.createElement('div');
  travelersContainer.className = 'travelers-container';

  // Ensure the route exists and has a defined travelers value
  const route = appState.routes[routeNumber];
  const travelersCount = route ? route.travelers || 1 : 1;  // Default to 1 if undefined

  const dropdownBtn = document.createElement('button');
  dropdownBtn.id = 'travelersDropdownBtn';
  dropdownBtn.className = 'travelers-dropdown-btn';
  dropdownBtn.innerHTML = `<img src="assets/person.svg" alt="" class="icon-person"> ${travelersCount} <span class="icon-dropdown"></span>`;
  travelersContainer.appendChild(dropdownBtn);

  const dropdownList = document.createElement('ul');
  dropdownList.id = 'travelersDropdown';
  dropdownList.className = 'travelers-dropdown hidden';
  const travelersOptions = ['1', '2', '3', '4', '5', '6', '7', '8']; // Adjust number of travelers as needed

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

  travelersOptions.forEach(option => {
    const listItem = document.createElement('li');
    listItem.textContent = option;
    dropdownList.appendChild(listItem);

    listItem.addEventListener('click', function() {
      updateState('updateTravelers', { routeNumber, travelers: this.textContent }, 'travelersPicker.travelersPicker');
      dropdownBtn.innerHTML = `<img src="assets/person.svg" alt="" class="icon-person"> ${this.textContent} <span class="icon-dropdown"></span>`;
      dropdownList.classList.add('hidden');
    });
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

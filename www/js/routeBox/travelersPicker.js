import { appState, updateState } from "../stateManager.js";

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

  // Position dropdown based on available space
  const positionDropdown = () => {
    const buttonRect = dropdownBtn.getBoundingClientRect();
    const dropdownRect = dropdownList.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    
    const spaceBelow = viewportHeight - buttonRect.bottom;
    const spaceAbove = buttonRect.top;
    
    if (spaceBelow < dropdownRect.height && spaceAbove > dropdownRect.height) {
      dropdownList.style.bottom = '100%';
      dropdownList.style.top = 'auto';
      dropdownList.classList.add('dropdown-up');
    } else {
      dropdownList.style.top = '100%';
      dropdownList.style.bottom = 'auto';
      dropdownList.classList.remove('dropdown-up');
    }
  };

  dropdownBtn.addEventListener('click', () => {
    dropdownList.classList.toggle('hidden');
    if (!dropdownList.classList.contains('hidden')) {
      positionDropdown();
    }
  });

  // Update position on scroll/resize
  window.addEventListener('scroll', () => {
    if (!dropdownList.classList.contains('hidden')) {
      positionDropdown();
    }
  });

  window.addEventListener('resize', () => {
    if (!dropdownList.classList.contains('hidden')) {
      positionDropdown();
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

  return travelersContainer;  // Return the complete component
}

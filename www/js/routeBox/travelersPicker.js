import { appState, updateState } from "../stateManager.js";

export function travelersPicker(routeNumber) {
  const travelersContainer = document.createElement('div');
  travelersContainer.className = 'travelers-container';

  // Create dropdown button
  const dropdownBtn = document.createElement('button');
  dropdownBtn.id = 'travelersDropdownBtn';
  dropdownBtn.className = 'travelers-dropdown-btn';
  dropdownBtn.innerHTML = '<img src="assets/person.svg" alt="" class="icon-person"> 1 <span class="icon-dropdown"></span>';
  travelersContainer.appendChild(dropdownBtn);

  // Create dropdown list
  const dropdownList = document.createElement('ul');
  dropdownList.id = 'travelersDropdown';
  dropdownList.className = 'travelers-dropdown hidden';
  const travelersOptions = ['1', '2', '3', '4', '5', '6', '7', '8']; // Adjust number of travelers as needed
  travelersOptions.forEach(option => {
      const listItem = document.createElement('li');
      listItem.textContent = option;
      dropdownList.appendChild(listItem);

      // Add click event to update the state and button face when an option is selected
      listItem.addEventListener('click', function() {
          dropdownBtn.innerHTML = `<img src="assets/person.svg" alt="" class="icon-person"> ${this.textContent} <span class="icon-dropdown"></span>`; // Update button face
          dropdownList.classList.add('hidden'); // Hide the dropdown after selection
          console.log('routeNumber: ', routeNumber, 'travelers: ', this.textContent, 'appState.routes', appState.routes);
          updateState('updateTravelers', routeNumber, this.textContent); // Update the state with selected option
          
      });
  });

  travelersContainer.appendChild(dropdownList);

  // Toggle dropdown visibility on button click
  dropdownBtn.addEventListener('click', function() {
      dropdownList.classList.toggle('hidden');
  });

  return travelersContainer;  // Ensure this line is added
}

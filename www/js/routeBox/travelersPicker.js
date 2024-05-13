export function travelersPicker() {
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
  });

  travelersContainer.appendChild(dropdownList);
  return travelersContainer;  // Ensure this line is added
}

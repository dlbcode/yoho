import { appState, updateState } from '../stateManager.js';
import { pathDrawing } from '../pathDrawing.js';
import { flightMap } from '../flightMap.js';

function routeInfoRow(flight, rowElement, routeIndex) {
    console.log('routeInfoRow called with:', flight, routeIndex);
    console.log('Row Element:', rowElement);
    console.log('Parent Node:', rowElement.parentNode);

    // Create a new row for detailed information
    const detailRow = document.createElement('tr');
    const detailCell = document.createElement('td');
    detailCell.colSpan = 9;  // Assuming there are 9 columns in your table
    detailCell.innerHTML = `
        <div>Route Details for ${flight.airlines.join(", ")}:</div>
        <div>Price: $${flight.price.toFixed(2)}</div>
        <button id="selectRoute">Select Route</button>
    `;
    detailRow.appendChild(detailCell);

    // Insert the new row right after the clicked row in the table
    if (rowElement.nextSibling) {
        rowElement.parentNode.insertBefore(detailRow, rowElement.nextSibling);
    } else {
        rowElement.parentNode.appendChild(detailRow);  // Append to the end if there's no next sibling
    }

    const selectRouteButton = detailCell.querySelector('#selectRoute');
    selectRouteButton.addEventListener('click', () => {

      // row click functionality to go here

    });
} 

export { routeInfoRow };

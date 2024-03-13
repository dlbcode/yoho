import { appState } from './stateManager.js';

const routeDateButtons = {
  updateDayNameBoxes: function() {
    const dayNameBoxes = document.querySelectorAll('.day-name-box');
    dayNameBoxes.forEach(box => {
        const routeNumber = parseInt(box.getAttribute('data-route-number'));
        if (appState.routeDates[routeNumber]) {
            // Check if the date is a range and split it if necessary
            const effectiveDate = appState.routeDates[routeNumber].includes(' to ') ? appState.routeDates[routeNumber].split(' to ')[0] : appState.routeDates[routeNumber];
            const dateParts = effectiveDate.split('-');
            let newDayName = new Date(Date.UTC(dateParts[0], dateParts[1] - 1, dateParts[2])).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' })[0];
            box.textContent = newDayName;

            if (newDayName === 'S') {
                box.style.backgroundColor = '#01481a'; // Set background color to green for weekend days
            } else {
                box.style.backgroundColor = ''; // Reset background color for non-weekend days
            }
        }
    });
  },    

  updateMonthNameBoxes: function() {
    const container = document.querySelector('.airport-selection');
    let previousMonth = null;

    document.querySelectorAll('.route-container').forEach((routeDiv, index) => {
        const routeNumber = parseInt(routeDiv.getAttribute('data-route-number'));
        const routeDate = appState.routeDates[routeNumber];
        if (routeDate) {
            // Check if the date is a range and split it if necessary
            const effectiveDate = routeDate.includes(' to ') ? routeDate.split(' to ')[0] : routeDate;
            const dateParts = effectiveDate.split('-');
            const currentMonth = new Date(Date.UTC(dateParts[0], dateParts[1] - 1, dateParts[2])).getMonth();

            if (currentMonth !== previousMonth) {
                let monthNameBox;
                if (routeDiv.previousElementSibling && routeDiv.previousElementSibling.classList.contains('month-name-box')) {
                    monthNameBox = routeDiv.previousElementSibling;
                } else {
                    monthNameBox = document.createElement('div');
                    monthNameBox.className = 'month-name-box';
                    container.insertBefore(monthNameBox, routeDiv);
                }

                const monthName = new Date(Date.UTC(dateParts[0], dateParts[1] - 1, dateParts[2])).toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' });
                monthNameBox.textContent = monthName;

                previousMonth = currentMonth;
            } else {
                if (routeDiv.previousElementSibling && routeDiv.previousElementSibling.classList.contains('month-name-box')) {
                    container.removeChild(routeDiv.previousElementSibling);
                }
            }
        }
    });
  },

  updateDateButtonsDisplay: function() {
    document.querySelectorAll('.date-select-button').forEach(button => {
        const routeNumber = button.closest('.route-container').getAttribute('data-route-number');
        const dateValue = appState.routeDates[routeNumber];
        if (dateValue) {
            // Parse the date as UTC to avoid timezone issues
            const [year, month, day] = dateValue.split('-').map(num => parseInt(num, 10));
            const date = new Date(Date.UTC(year, month - 1, day));

            // Format the date as needed, here we're just using the day of the month
            button.textContent = date.getUTCDate().toString(); // Use getUTCDate() to get the day in UTC
        }
    });
  },
  
  updateDateButtons: function() {
    this.updateDayNameBoxes();
    this.updateMonthNameBoxes();
    this.updateDateButtonsDisplay();
  }
}

export { routeDateButtons };
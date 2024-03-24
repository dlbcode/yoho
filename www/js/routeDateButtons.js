import { appState } from './stateManager.js';

const routeDateButtons = {
  updateDayNameBoxes: function() {
    const dayNameBoxes = document.querySelectorAll('.day-name-box');
    dayNameBoxes.forEach(box => {
        const routeNumber = parseInt(box.getAttribute('data-route-number'));
        // Use current UTC date if routeDate is null
        const currentDate = new Date().toISOString().split('T')[0]; // Get current UTC date as fallback
        const routeDate = appState.routeDates[routeNumber] || currentDate;
        
        // Check if the date is a range and split it if necessary
        const effectiveDate = routeDate.includes(' to ') ? routeDate.split(' to ')[0] : routeDate;
        const dateParts = effectiveDate.split('-');
        let newDayName = new Date(Date.UTC(dateParts[0], dateParts[1] - 1, dateParts[2])).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
        box.textContent = newDayName;

        if (newDayName === 'Sun' || newDayName === 'Sat') {
            box.style.backgroundColor = '#01481a'; // Set background color to green for weekend days
        } else {
            box.style.backgroundColor = ''; // Reset background color for non-weekend days
        }        
    });
}, 

  updateMonthNameBoxes: function() {
    const container = document.querySelector('.airport-selection');
    let previousMonth = null;

    document.querySelectorAll('.route-container').forEach((routeDiv, index) => {
        const routeNumber = parseInt(routeDiv.getAttribute('data-route-number'));
        const routeDate = appState.routeDates[routeNumber];
        //console.log('routeDate: ',routeDate);
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
          button.textContent = dateValue.includes(' to ') ? '[..]' : new Date(dateValue).getUTCDate().toString();
        }
    });
  },
  
  updateDateButtons: function() {
    this.updateDayNameBoxes();
    this.updateDateButtonsDisplay();
    this.updateMonthNameBoxes();
  }
}

document.addEventListener('stateChange', function(event) {
    if (event.detail.key === 'updateRouteDate' || event.detail.key === 'updateRoutes') {
        routeDateButtons.updateDayNameBoxes();
        routeDateButtons.updateMonthNameBoxes();
    }
});

export { routeDateButtons };
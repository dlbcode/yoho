import { appState } from './stateManager.js';

const routeDateButtons = {
  updateDayNameBoxes: function() {
    const dayNameBoxes = document.querySelectorAll('.day-name-box');
    dayNameBoxes.forEach(box => {
        const routeNumber = parseInt(box.getAttribute('data-route-number'));
        // Use current UTC date if routeDate is null
        const currentDate = new Date().toISOString().split('T')[0]; // Get current UTC date as fallback
        const routeDate = appState.routeDates[routeNumber] || currentDate;
        
        let newDayName;
        if (routeDate === 'any') {
            newDayName = 'Any';
            box.style.backgroundColor = ''; // Reset background color
        } else {
            // Check if the date is a range and split it if necessary
            const effectiveDate = routeDate.includes(' to ') ? routeDate.split(' to ')[0] : routeDate;
            const dateParts = effectiveDate.split('-');
            newDayName = new Date(Date.UTC(dateParts[0], dateParts[1] - 1, dateParts[2])).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });

            if (newDayName === 'Sun' || newDayName === 'Sat') {
                box.style.backgroundColor = '#01481a'; // Set background color to green for weekend days
            } else {
                box.style.backgroundColor = ''; // Reset background color for non-weekend days
            }        
        }

        box.textContent = newDayName;
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
            let monthName;
            if (routeDate === 'any') {
                monthName = 'All Months';
            } else {
                // Check if the date is a range and split it if necessary
                const effectiveDate = routeDate.includes(' to ') ? routeDate.split(' to ')[0] : routeDate;
                const dateParts = effectiveDate.split('-');
                const currentMonth = new Date(Date.UTC(dateParts[0], dateParts[1] - 1, dateParts[2])).getMonth();

                if (currentMonth !== previousMonth) {
                    monthName = new Date(Date.UTC(dateParts[0], dateParts[1] - 1, dateParts[2])).toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' });
                    previousMonth = currentMonth;
                }
            }

            let monthNameBox;
            if (routeDiv.previousElementSibling && routeDiv.previousElementSibling.classList.contains('month-name-box')) {
                monthNameBox = routeDiv.previousElementSibling;
            } else {
                monthNameBox = document.createElement('div');
                monthNameBox.className = 'month-name-box';
                container.insertBefore(monthNameBox, routeDiv);
            }

            monthNameBox.textContent = monthName;
        }
    });
  },

  updateDateButtonsDisplay: function() {
    document.querySelectorAll('.date-select-button').forEach(button => {
        const routeNumber = button.closest('.route-container').getAttribute('data-route-number');
        const dateValue = appState.routeDates[routeNumber];
        if (dateValue) {
            if (dateValue === 'any') {
                button.textContent = '<>';
            } else {
                button.textContent = dateValue.includes(' to ') ? '[..]' : new Date(dateValue).getUTCDate().toString();
            }
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
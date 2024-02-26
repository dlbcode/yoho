import { routeList } from './routeList.js';

const leftPane = {
    init() {
        routeList.init();
        this.initDatePicker();
    },

    initDatePicker() {
        const datePicker = document.getElementById('travelDate');
        const dateDisplay = document.getElementById('formattedDateDisplay');
        datePicker.addEventListener('change', function() {
            const selectedDate = new Date(this.value);
            const options = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
            const formattedDate = selectedDate.toLocaleDateString('en-US', options).replace(',', '').toUpperCase();
            // Update the visible date display
            dateDisplay.textContent = formattedDate;
        });

        // Initialize the display text if you want to set a default date
        // dateDisplay.textContent = 'Select Date'; // Or any other default text
    },
};

document.addEventListener('DOMContentLoaded', function() {
  const datePicker = document.getElementById('travelDate');
  const dateDisplay = document.getElementById('formattedDateDisplay');

  // Ensure this event listener is correctly set up
  dateDisplay.addEventListener('click', function() {
      datePicker.click(); // This should trigger the hidden date picker
  });

  datePicker.addEventListener('change', function() {
      const selectedDate = new Date(this.value);
      const options = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
      const formattedDate = selectedDate.toLocaleDateString('en-US', options).replace(',', '').toUpperCase();
      dateDisplay.textContent = formattedDate; // Update the visible date display
  });
});

export { leftPane };

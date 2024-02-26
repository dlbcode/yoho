import { routeList } from './routeList.js';

const leftPane = {
    init() {
        routeList.init();
    },

    // Additional methods for leftPane can go here
};

document.addEventListener('DOMContentLoaded', function() {
  const datePicker = document.getElementById('travelDate');
  leftPane.init();
  datePicker.addEventListener('change', function() {
      console.log('Selected date: ', datePicker.value);
      // You can now use datePicker.value in your application
  });
});

export { leftPane };

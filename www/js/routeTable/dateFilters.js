function createDateFilterPopup(column) {
  const filterPopup = document.createElement('div');
  filterPopup.id = `${column}DateFilterPopup`;
  filterPopup.className = 'date-filter-popup';
  filterPopup.innerHTML = `<div class="popup-content">Filter settings for ${column}</div>`;
  document.body.appendChild(filterPopup);
  return filterPopup;
}

function loadNoUiSlider() {
  if (!window.noUiSlider) {
      const script = document.createElement('script');
      script.src = "https://cdn.jsdelivr.net/npm/nouislider/distribute/nouislider.min.js";
      script.onload = () => {
          console.log('noUiSlider is loaded and ready to use!');
          initializeSlider();
      };
      document.head.appendChild(script);

      const link = document.createElement('link');
      link.rel = "stylesheet";
      link.href = "https://cdn.jsdelivr.net/npm/nouislider/distribute/nouislider.min.css";
      document.head.appendChild(link);
  } else {
      initializeSlider();
  }
}

function initializeSlider() {
  const sliderElement = document.getElementById('slider');
  if (sliderElement) {
      noUiSlider.create(sliderElement, {
          start: [10, 30],
          connect: true,
          range: {
              'min': 0,
              'max': 40
          }
      });
  } else {
      console.error("Slider element not found!");
  }
}

document.addEventListener('DOMContentLoaded', function() {
  loadNoUiSlider();
});

// Call loadNoUiSlider when you need to setup the slider
loadNoUiSlider();

function createTimeRangeSlider() {
  const slider = document.createElement('div');
  noUiSlider.create(slider, {
    start: [0, 24],
    connect: true,
    range: {
      'min': 0,
      'max': 24
    },
    step: 0.5,
    format: {
      to: function (value) {
        const hours = Math.floor(value);
        const minutes = Math.floor((value % 1) * 60);
        return `${hours}:${minutes < 10 ? '0' : ''}${minutes}`;
      },
      from: function (value) {
        const parts = value.split(':');
        return parseInt(parts[0]) + parseInt(parts[1])/60;
      }
    }
  });

  slider.noUiSlider.on('update', function (values, handle) {
    filterTableByTime(values[0], values[1]);
  });

  return slider;
}

function filterTableByTime(startTime, endTime) {
  const table = document.querySelector('.route-info-table');
  const rows = table.querySelectorAll('tbody tr');

  rows.forEach(row => {
      const departureTime = getTimeFromDateTimeString(row.cells[getColumnIndex('departure') - 1].textContent);
      const arrivalTime = getTimeFromDateTimeString(row.cells[getColumnIndex('arrival') - 1].textContent);
      const departureInRange = isTimeInRange(departureTime, startTime, endTime);
      const arrivalInRange = isTimeInRange(arrivalTime, startTime, endTime);

      if (departureInRange && arrivalInRange) {
          row.style.display = ''; // Show rows where both departure and arrival are within the range
      } else {
          row.style.display = 'none'; // Hide rows outside the time range
      }
  });
}

function getTimeFromDateTimeString(dateTimeString) {
  const timeString = dateTimeString.split(' ')[1]; // Assumes date and time are separated by a space
  const hours = parseInt(timeString.split(':')[0]);
  const minutes = parseInt(timeString.split(':')[1]);
  return hours + minutes / 60; // Convert time to a decimal hour format
}

function isTimeInRange(time, startTime, endTime) {
  return time >= startTime && time <= endTime;
}

function getColumnIndex(columnIdentifier) {
  const columnMap = {
    'departure': 1,
    'arrival': 2,
  };
  return columnMap[columnIdentifier] || -1;
}

function showDateFilterPopup(event, column) {
  let existingPopup = document.getElementById(`${column}DateFilterPopup`);
  
  if (!existingPopup) {
    existingPopup = createDateFilterPopup(column);
    document.body.appendChild(existingPopup);
  } else {
    existingPopup.classList.toggle('hidden');
  }
  
  if (!existingPopup.classList.contains('hidden')) {
    requestAnimationFrame(() => {
      const header = event.target.closest('th');
      if (header) {
        const rect = header.getBoundingClientRect();
        existingPopup.style.left = `${rect.left + window.scrollX}px`;
        existingPopup.style.top = `${rect.top + window.scrollY - existingPopup.offsetHeight}px`;
      }
    });
  }
}

// Global click listener to hide popup if click occurred outside
document.addEventListener('click', function(event) {
  const datePopups = document.querySelectorAll('.date-filter-popup');
  datePopups.forEach(popup => {
    if (!popup.contains(event.target) && !event.target.closest('.filterIcon')) {
      popup.classList.add('hidden');
    }
  });
});

export { showDateFilterPopup };

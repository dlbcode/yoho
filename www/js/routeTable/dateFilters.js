function createDateFilterPopup(column) {
  const filterPopup = document.createElement('div');
  filterPopup.id = `${column}DateFilterPopup`;
  filterPopup.className = 'date-filter-popup';

  if (column === 'departure' || column === 'arrival') {
    filterPopup.innerHTML = `<div id="${column}Slider"></div>`; // Only include the slider div
  }
  document.body.appendChild(filterPopup);
  return filterPopup;
}

function loadNoUiSlider() {
  if (!window.noUiSlider) {
    const script = document.createElement('script');
    script.src = "https://cdn.jsdelivr.net/npm/nouislider/distribute/nouislider.min.js";
    document.head.appendChild(script);
    const link = document.createElement('link');
    link.rel = "stylesheet";
    link.href = "https://cdn.jsdelivr.net/npm/nouislider/distribute/nouislider.min.css";
    document.head.appendChild(link);
  }
}

function initializeSlider(sliderId) {
  const sliderElement = document.getElementById(sliderId);
  if (sliderElement) {
    noUiSlider.create(sliderElement, {
      start: [0, 24],  // Covering the full day from 0 hours to 24 hours
      connect: true,
      range: {
          'min': 0,
          'max': 24
      },
      step: 0.5,  // Setting the step to 0.5 hours, which is 30 minutes
      tooltips: [true, true],  // Enable tooltips for both handles
      format: {
        to: function(value) {  // Ensure tooltips and time display use the same format
          const hours = Math.floor(value);
          const minutes = Math.floor((value % 1) * 60);
          return `${hours}:${minutes < 10 ? '0' + minutes : minutes}`;
        },
        from: Number
      }
    });

    // Ensure the time-display element is created and added to the DOM
    let timeDisplay = document.querySelector('.time-display');
    if (!timeDisplay) {
      timeDisplay = document.createElement('div');
      timeDisplay.className = 'time-display';
      sliderElement.parentElement.insertBefore(timeDisplay, sliderElement);
    }

    sliderElement.noUiSlider.on('start', function () {
      // Show tooltips when a handle is clicked or touched
      const tooltips = sliderElement.querySelectorAll('.noUi-tooltip');
      tooltips.forEach(tooltip => {
        tooltip.style.display = 'block';
      });
    });

    // Add blur event handler to hide tooltips when slider loses focus
    const handles = sliderElement.querySelectorAll('.noUi-handle');
    handles.forEach(handle => {
      handle.addEventListener('blur', function () {
        const tooltips = sliderElement.querySelectorAll('.noUi-tooltip');
        tooltips.forEach(tooltip => {
          tooltip.style.display = 'none';
        });
      });
    });

    sliderElement.noUiSlider.on('update', function (values, handle) {
      console.log("Updating time display with:", values);
      if (timeDisplay) {
        timeDisplay.textContent = `${values[0]} – ${values[1]}`;
      } else {
        console.error('Time display element not found, creating a new one');
        timeDisplay = document.createElement('div');
        timeDisplay.className = 'time-display';
        sliderElement.parentElement.insertBefore(timeDisplay, sliderElement);
        timeDisplay.textContent = `${values[0]} – ${values[1]}`;
      }

      // Ensure slider handles retain their custom styling
      const handles = sliderElement.querySelectorAll('.noUi-handle');
      handles.forEach(handle => {
        handle.classList.add('slider-handle');  // Re-add class for custom styling
      });

      filterTableByTime(values[0], values[1], sliderId.includes('departure') ? 0 : 1);
    });
  } else {
    console.error("Slider element not found!");
  }
}

function filterTableByTime(startTime, endTime, columnIndex) {
  const rows = document.querySelectorAll('.route-info-table tbody tr');
  rows.forEach(row => {
    const timeCell = row.cells[columnIndex].textContent;
    const timeMatch = timeCell.match(/(\d{1,2}:\d{2}:\d{2}) (AM|PM)/);
    if (timeMatch) {
      const timeString = timeMatch[1] + ' ' + timeMatch[2];
      const timeValue = convertTimeToDecimal(timeString); // Convert to decimal hours
      const isVisible = timeValue >= parseFloat(startTime) && timeValue <= parseFloat(endTime);
      row.style.display = isVisible ? '' : 'none';
    }
  });
}

function convertTimeToDecimal(timeStr) {
  const [time, modifier] = timeStr.split(' ');
  let [hours, minutes] = time.split(':');
  hours = parseInt(hours);
  minutes = parseInt(minutes);

  if (modifier === 'PM' && hours < 12) hours += 12;
  if (modifier === 'AM' && hours === 12) hours = 0;

  return hours + minutes / 60;
}

document.addEventListener('DOMContentLoaded', function() {
  loadNoUiSlider();
});

function showDateFilterPopup(event, column) {
  let existingPopup = document.getElementById(`${column}DateFilterPopup`);

  if (!existingPopup) {
    existingPopup = createDateFilterPopup(column);
  }
  existingPopup.classList.toggle('hidden', false);

  requestAnimationFrame(() => {
    if (!existingPopup.classList.contains('hidden')) {
      const icon = event.target.closest('.filterIcon');
      if (icon) {
        const rect = icon.getBoundingClientRect();
        existingPopup.style.position = 'absolute';
        existingPopup.style.left = `${rect.left + window.scrollX}px`;
        existingPopup.style.top = `${rect.top + window.scrollY - existingPopup.offsetHeight - 5}px`;
      }
      if (column === 'departure' || column === 'arrival') {
        initializeSlider(`${column}Slider`);
      }
    }
  });
}

document.addEventListener('click', function(event) {
  const datePopups = document.querySelectorAll('.date-filter-popup');
  datePopups.forEach(popup => {
    if (!popup.contains(event.target) && !event.target.closest('.filterIcon')) {
      popup.classList.add('hidden');
    }
  });
});

export { showDateFilterPopup };

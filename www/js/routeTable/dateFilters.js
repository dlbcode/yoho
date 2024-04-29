import { appState } from '../stateManager.js';

appState.filterState = {
  departure: { start: 0, end: 24 },
  arrival: { start: 0, end: 24 }
};

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
      start: [0, 24],
      connect: true,
      range: {
          'min': 0,
          'max': 24
      },
      step: 0.5,
      tooltips: [true, true],
      format: {
        to: function(value) {
          const hours = Math.floor(value);
          const minutes = Math.floor((value % 1) * 60);
          return `${hours}:${minutes < 10 ? '0' + minutes : minutes}`;
        },
        from: Number
      }
    });

    const column = sliderId.replace('Slider', '');
    let timeDisplay = document.querySelector(`.time-display-${column}`);
    if (!timeDisplay) {
      timeDisplay = document.createElement('div');
      timeDisplay.className = `time-display time-display-${column}`;
      sliderElement.parentElement.insertBefore(timeDisplay, sliderElement);
    }

    sliderElement.noUiSlider.on('start', function () {
      const tooltips = sliderElement.querySelectorAll('.noUi-tooltip');
      tooltips.forEach(tooltip => {
        tooltip.style.display = 'block';
      });
    });

    const handles = sliderElement.querySelectorAll('.noUi-handle');
    handles.forEach((handle, index) => {
      handle.addEventListener('blur', function () {
        setTimeout(() => {
          const otherHandle = handles[(index + 1) % handles.length];
          if (document.activeElement !== otherHandle) {
            const tooltips = sliderElement.querySelectorAll('.noUi-tooltip');
            tooltips.forEach(tooltip => {
              tooltip.style.display = 'none';
            });
          }
        }, 0);
      });
    });

    sliderElement.noUiSlider.on('update', function (values, handle) {
      const formattedValues = values.map(value => formatTo12Hour(convertToDecimalHours(value)));
      console.log("Updating time display with formatted values:", formattedValues);
      if (timeDisplay) {
        timeDisplay.textContent = `${formattedValues[0]} – ${formattedValues[1]}`;
      }
    });

    function formatTo12Hour(value) {
      if (value === 24 || value === 0) {
        return "12:00 AM";
      }
      let hours = Math.floor(value);
      let decimalPart = value % 1;
      const minutes = Math.floor(decimalPart * 60);
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      return `${hours}:${minutes < 10 ? '0' + minutes : minutes} ${ampm}`;
    }

    function convertToDecimalHours(value) {
      if (typeof value === "string" && value.includes(':')) {
        let parts = value.split(':');
        let hours = parseInt(parts[0], 10);
        let minutes = parseInt(parts[1], 10);
        return hours + (minutes / 60);
      }
      return parseFloat(value);
    }
    
    sliderElement.noUiSlider.on('update', function (values, handle) {
      const formattedValues = values.map(value => {
        value = convertToDecimalHours(value); // Convert to decimal hours if needed
    
        return formatTo12Hour(value); // Format to 12-hour display
      });
    
      console.log("Updating time display with formatted values:", formattedValues);
    
      if (timeDisplay) {
        timeDisplay.textContent = `${formattedValues[0]} – ${formattedValues[1]}`;
      } else {
        console.error('Time display element not found, creating a new one');
        timeDisplay = document.createElement('div');
        timeDisplay.className = 'time-display';
        sliderElement.parentElement.insertBefore(timeDisplay, sliderElement);
        timeDisplay.textContent = `${formattedValues[0]} – ${formattedValues[1]}`;
      }

      const handles = sliderElement.querySelectorAll('.noUi-handle');
      handles.forEach(handle => {
        handle.classList.add('slider-handle');  // Re-add class for custom styling
      });
      appState.filterState[column] = { start: values[0], end: values[1] };
      filterTableByTime(values[0], values[1], sliderId.includes('departure') ? 0 : 1);
    });
  }
}  

function filterTableByTime() {
  const rows = document.querySelectorAll('.route-info-table tbody tr');
  rows.forEach(row => {
    const departureTimeCell = row.cells[0].textContent;
    const arrivalTimeCell = row.cells[1].textContent;
    const departureTimeMatch = departureTimeCell.match(/(\d{1,2}:\d{2}:\d{2}) (AM|PM)/);
    const arrivalTimeMatch = arrivalTimeCell.match(/(\d{1,2}:\d{2}:\d{2}) (AM|PM)/);
    if (departureTimeMatch && arrivalTimeMatch) {
      const departureTimeString = departureTimeMatch[1] + ' ' + departureTimeMatch[2];
      const arrivalTimeString = arrivalTimeMatch[1] + ' ' + arrivalTimeMatch[2];
      const departureTimeValue = convertTimeToDecimal(departureTimeString); // Convert to decimal hours
      const arrivalTimeValue = convertTimeToDecimal(arrivalTimeString); // Convert to decimal hours
      const isDepartureTimeVisible = departureTimeValue >= parseFloat(appState.filterState.departure.start) && departureTimeValue <= parseFloat(appState.filterState.departure.end);
      const isArrivalTimeVisible = arrivalTimeValue >= parseFloat(appState.filterState.arrival.start) && arrivalTimeValue <= parseFloat(appState.filterState.arrival.end);
      const isVisible = isDepartureTimeVisible && isArrivalTimeVisible;
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

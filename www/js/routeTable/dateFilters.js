function createDateFilterPopup(column) {
  const filterPopup = document.createElement('div');
  filterPopup.id = `${column}DateFilterPopup`;
  filterPopup.className = 'date-filter-popup';

  const content = `<div class="popup-content">Filter settings for ${column}</div>`;
  if (column === 'departure' || column === 'arrival') {
    filterPopup.innerHTML = `${content}<div id="${column}Slider"></div>`; // Unique ID for each slider
  } else {
    filterPopup.innerHTML = content;
  }
  document.body.appendChild(filterPopup);
  return filterPopup;
}

function loadNoUiSlider() {
  if (!window.noUiSlider) {
    const script = document.createElement('script');
    script.src = "https://cdn.jsdelivr.net/npm/nouislider/distribute/nouislider.min.js";
    script.onload = () => {
        console.log('noUiSlider is loaded and ready to use!');
    };
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
      start: [0, 24],  // Set to cover the full day from 0 hours to 24 hours
      connect: true,
      range: {
          'min': 0,
          'max': 24
      }
    });

    // Creating elements to display the selected time range
    const timeDisplay = document.createElement('div');
    timeDisplay.className = 'time-display';
    sliderElement.parentElement.insertBefore(timeDisplay, sliderElement);

    sliderElement.noUiSlider.on('update', function (values) {
      const startTime = formatTime(values[0]);
      const endTime = formatTime(values[1]);
      timeDisplay.textContent = `${startTime} – ${endTime}`;  // Updating the display
      filterTableByTime(values[0], values[1], sliderId.includes('departure') ? 0 : 1);
    });
  } else {
    console.error("Slider element not found!");
  }
}

function formatTime(value) {
  const hours = Math.floor(value);
  const minutes = Math.floor((value % 1) * 60);
  return `${hours}:${minutes < 10 ? '0' : ''}${minutes}`;
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

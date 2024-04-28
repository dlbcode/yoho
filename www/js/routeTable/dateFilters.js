function createDateFilterPopup(column) {
  const filterPopup = document.createElement('div');
  filterPopup.id = `${column}DateFilterPopup`;
  filterPopup.className = 'date-filter-popup';

  // Simplified content, no longer adding extra descriptions
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
      start: [0, 24],  // Full day
      connect: true,
      range: { 'min': 0, 'max': 24 },
      step: 0.5,  // Half-hour increments
      tooltips: [true, true],  // Enable tooltips for both handles
      format: {
        to: function(value) {
          return formatTime(value);  // Use updated formatTime function for tooltip
        },
        from: Number
      }
    });

    const handles = sliderElement.querySelectorAll('.noUi-handle');
    handles.forEach(handle => {
      handle.classList.add('slider-handle');  // Apply the custom class

      // Add event listeners to handle interactions
      handle.addEventListener('mousedown', function() {
        this.querySelector('.noUi-tooltip').style.display = 'block';  // Show tooltip on mouse down
      });
      handle.addEventListener('touchstart', function() {
        this.querySelector('.noUi-tooltip').style.display = 'block';  // Show tooltip on touch start
      });
    });

    let timeDisplay = document.querySelector('.time-display');
    if (!timeDisplay) {
      timeDisplay = document.createElement('div');
      timeDisplay.className = 'time-display';
      sliderElement.parentElement.insertBefore(timeDisplay, sliderElement);
    }

    // Function to update time display based on slider values
    function updateTimeDisplay() {
      const values = sliderElement.noUiSlider.get();
      const startTime = formatTime(parseFloat(values[0]));
      const endTime = formatTime(parseFloat(values[1]));
      timeDisplay.textContent = `${startTime} – ${endTime}`;
    }

    // Initialize with current values
    updateTimeDisplay();

    sliderElement.noUiSlider.on('update', function (values, handle) {
      updateTimeDisplay();  // Update on slider move
    });
  } else {
    console.error("Slider element not found!");
  }
}

function formatTime(value) {
  let hours = Math.floor(value);
  const minutes = Math.floor((value % 1) * 60);
  const amPm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  return `${hours}:${minutes < 10 ? '0' : ''}${minutes} ${amPm}`;
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

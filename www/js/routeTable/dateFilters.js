function createDateFilterPopup(column) {
  const filterPopup = document.createElement('div');
  filterPopup.id = `${column}DateFilterPopup`;
  filterPopup.className = 'date-filter-popup';

  // Add slider element directly within the popup for relevant columns
  const content = `<div class="popup-content">Filter settings for ${column}</div>`;
  if (column === 'departure' || column === 'arrival') {
    filterPopup.innerHTML = `${content}<div id="${column}Slider"></div>`; // Correct the ID to be unique
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

// Ensure noUiSlider loads and initializes only when DOM is fully ready
document.addEventListener('DOMContentLoaded', function() {
  loadNoUiSlider();
});

function showDateFilterPopup(event, column) {
  let existingPopup = document.getElementById(`${column}DateFilterPopup`);

  if (!existingPopup) {
      existingPopup = createDateFilterPopup(column);
  }

  // Toggle visibility and ensure it's visible before positioning
  existingPopup.classList.toggle('hidden', false);

  requestAnimationFrame(() => {
      // Ensure the popup is visible when getting its dimensions
      if (!existingPopup.classList.contains('hidden')) {
          const icon = event.target.closest('.filterIcon');
          if (icon) {
              const rect = icon.getBoundingClientRect();
              existingPopup.style.position = 'absolute';
              existingPopup.style.left = `${rect.left + window.scrollX}px`;
              existingPopup.style.top = `${rect.top + window.scrollY - existingPopup.offsetHeight - 5}px`; // Adjusted to be 5px above the icon
          }

          // Initialize the slider only if for 'departure' or 'arrival'
          if (column === 'departure' || column === 'arrival') {
              initializeSlider(`${column}Slider`);
          }
      }
  });
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

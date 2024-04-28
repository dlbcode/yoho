document.addEventListener('DOMContentLoaded', loadNoUiSlider);

function loadNoUiSlider() {
  if (!window.noUiSlider) {
    appendElement(document.head, 'script', {
      src: "https://cdn.jsdelivr.net/npm/nouislider/distribute/nouislider.min.js",
      onload: () => console.log('noUiSlider is loaded and ready to use!')
    });
    appendElement(document.head, 'link', {
      rel: "stylesheet",
      href: "https://cdn.jsdelivr.net/npm/nouislider/distribute/nouislider.min.css"
    });
  }
}

function appendElement(parent, type, attributes) {
  const element = document.createElement(type);
  Object.keys(attributes).forEach(key => element[key] = attributes[key]);
  parent.appendChild(element);
}

function initializeSlider(sliderId) {
  const sliderElement = document.getElementById(sliderId);
  if (!sliderElement) {
    console.error("Slider element not found!");
    return;
  }

  noUiSlider.create(sliderElement, {
    start: [0, 24],
    connect: true,
    range: { 'min': 0, 'max': 24 },
    step: 0.5,
    tooltips: [true, true],
    format: { to: formatTime, from: Number }
  });

  manageSliderHandles(sliderElement);
  const timeDisplay = updateTimeDisplayElement(sliderElement);
  sliderElement.noUiSlider.on('update', () => {
    const values = sliderElement.noUiSlider.get();
    updateTimeDisplay(values, timeDisplay);
    filterTableRows(parseFloat(values[0]), parseFloat(values[1]));
  });
}

function manageSliderHandles(sliderElement) {
  const handles = sliderElement.querySelectorAll('.noUi-handle');
  handles.forEach(handle => {
    handle.classList.add('slider-handle');
    const tooltip = handle.querySelector('.noUi-tooltip');
    tooltip.style.display = 'none';
    ['mousedown', 'touchstart'].forEach(event => {
      handle.addEventListener(event, () => tooltip.style.display = 'block');
    });
  });
}

function updateTimeDisplayElement(sliderElement) {
  let timeDisplay = document.querySelector('.time-display');
  if (!timeDisplay) {
    timeDisplay = document.createElement('div');
    timeDisplay.className = 'time-display';
    sliderElement.parentElement.insertBefore(timeDisplay, sliderElement);
  }
  return timeDisplay;
}

function updateTimeDisplay(values, displayElement) {
  const [start, end] = values.map(value => formatTime(parseFloat(value)));
  displayElement.textContent = `${start} – ${end}`;
}

function formatTime(value) {
  const hours = Math.floor(value) % 12 || 12;
  const minutes = Math.floor((value % 1) * 60).toString().padStart(2, '0');
  const amPm = value >= 12 ? 'PM' : 'AM';
  return `${hours}:${minutes} ${amPm}`;
}

function filterTableRows(startHour, endHour) {
  const table = document.querySelector('.route-info-table');
  const rows = table.querySelectorAll('tbody tr');
  rows.forEach(row => {
    const departureTime = getTimeFromDateTimeString(row.cells[0].textContent);
    const arrivalTime = getTimeFromDateTimeString(row.cells[1].textContent);
    const isVisible = departureTime >= startHour && departureTime <= endHour || arrivalTime >= startHour && arrivalTime <= endHour;
    row.style.display = isVisible ? '' : 'none';
  });
}

function getTimeFromDateTimeString(dateTimeStr) {
  const [, time, modifier] = dateTimeStr.match(/(\d+:\d+ [AP]M)/);
  const [hour, minute] = time.split(':');
  return parseInt(hour) % 12 + (modifier === 'PM' ? 12 : 0) + parseInt(minute) / 60;
}

function createDateFilterPopup(column) {
  const filterPopup = document.createElement('div');
  filterPopup.id = `${column}DateFilterPopup`;
  filterPopup.className = 'date-filter-popup';
  filterPopup.innerHTML = ['departure', 'arrival'].includes(column) ? `<div id="${column}Slider"></div>` : '';
  document.body.appendChild(filterPopup);
  return filterPopup;
}

function showDateFilterPopup(event, column) {
  let popup = document.getElementById(`${column}DateFilterPopup`) || createDateFilterPopup(column);
  popup.classList.remove('hidden');
  positionPopup(event.target.closest('.filterIcon'), popup);
  if (['departure', 'arrival'].includes(column)) initializeSlider(`${column}Slider`);
}

function positionPopup(icon, popup) {
  requestAnimationFrame(() => {
    if (!popup.classList.contains('hidden') && icon) {
      const rect = icon.getBoundingClientRect();
      popup.style.position = 'absolute';
      popup.style.left = `${rect.left + window.scrollX}px`;
      popup.style.top = `${rect.top + window.scrollY - popup.offsetHeight - 5}px`;
    }
  });
}

document.addEventListener('click', event => {
  document.querySelectorAll('.date-filter-popup').forEach(popup => {
    if (!popup.contains(event.target) && !event.target.closest('.filterIcon')) {
      popup.classList.add('hidden');
    }
  });
});

export { showDateFilterPopup };

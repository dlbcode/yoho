// Importing necessary functionality
import { appState } from '../stateManager.js';  // Assuming state manager handles global state

export function createFilterPopup(column, type, data, event) {
    const existingPopup = document.getElementById(`${column}FilterPopup`);
    if (existingPopup) {
        existingPopup.classList.toggle('hidden');
        return;
    }

    const filterPopup = document.createElement('div');
    filterPopup.id = `${column}FilterPopup`;
    filterPopup.className = 'filter-popup';
    filterPopup.style.width = '200px'; // Set width
    filterPopup.style.height = '80px'; // Set height
    filterPopup.style.position = 'absolute';
    document.body.appendChild(filterPopup);

    // Position the popup correctly using the event from the click
    positionPopup(filterPopup, event);

    initializeSlider(filterPopup, column, type, data);
}

function positionPopup(popup, event) {
    if (!event || !event.target) {
        console.error('Event or event target is undefined in positionPopup.');
        return;
    }
    const iconRect = event.target.getBoundingClientRect();
    popup.style.left = `${iconRect.left + window.scrollX}px`;
    popup.style.top = `${iconRect.top + window.scrollY - 90}px`; // Position above the icon
}

function initializeSlider(popup, column, type, data) {
    const slider = document.createElement('div');
    slider.id = `${column}Slider`;
    popup.appendChild(slider);

    // Slider settings without wNumb, using noUiSlider's format option
    const sliderSettings = {
        start: [type === 'range' ? data.min : data.median], // For a single handle use a median or any starting value
        connect: type === 'range' ? [true, false] : [true, false],
        range: {
            'min': data.min,
            'max': data.max
        },
        format: {
            to: function(value) {
                return `${column === 'price' ? '$' : ''}${Math.round(value)}`;
            },
            from: function(value) {
                return Number(value.replace('$', ''));
            }
        }
    };

    noUiSlider.create(slider, sliderSettings);

    slider.noUiSlider.on('update', function (values, handle) {
        appState.filterState[column] = { value: parseFloat(values[handle].replace('$', '')) };
        // Implement a callback or event dispatch to reapply filters
    });
}

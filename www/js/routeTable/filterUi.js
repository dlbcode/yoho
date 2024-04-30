// Importing necessary functionality
import { appState } from '../stateManager.js';  // Assuming state manager handles global state
import { logFilterState, applyFilters } from './tableFilter.js';

export function createFilterPopup(column, data, event) {
    const existingPopup = document.getElementById(`${column}FilterPopup`);
    if (existingPopup) {
        existingPopup.classList.toggle('hidden');
        if (!existingPopup.classList.contains('hidden')) {
            positionPopup(existingPopup, event);  // Update position every time it's shown
        }
        return;
    }

    const filterPopup = document.createElement('div');
    filterPopup.id = `${column}FilterPopup`;
    filterPopup.className = 'filter-popup';
    document.body.appendChild(filterPopup);

    if (!data) {
        console.error('No data provided for filtering:', column);
        return; // Do not proceed if no data is provided
    }

    positionPopup(filterPopup, event);  // Initial position setting

    console.log('Creating filter popup for:', column, data);

    initializeSlider(filterPopup, column, data);
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

function initializeSlider(popup, column, data) {
    const slider = document.createElement('div');
    slider.id = `${column}Slider`;
    popup.appendChild(slider);

    let sliderSettings;
    if (column === 'departure' || column === 'arrival') {
        sliderSettings = {
            start: [data.minTime || 0, data.maxTime || 24],
            connect: true,
            range: {
                'min': 0,
                'max': 24
            },
            step: 0.5,
            tooltips: true,
            format: {
                to: function(value) {
                    const hours = Math.floor(value);
                    const minutes = Math.floor((value % 1) * 60);
                    return `${hours}:${minutes < 10 ? '0' + minutes : minutes}`;
                },
                from: function(value) {
                    return parseFloat(value);
                }
            }
        };
    } else if (column === 'price') {
        if (data && data.hasOwnProperty('min') && data.hasOwnProperty('max')) {
            sliderSettings = {
                start: [data.max],
                connect: 'lower',
                range: {
                    'min': data.min,
                    'max': data.max
                },
                step: 1,
                tooltips: true,
                format: {
                    to: function(value) {
                        return `$${Math.round(value)}`;
                    },
                    from: function(value) {
                        return Number(value.replace('$', ''));
                    }
                }
            };
        } else {
            console.error('Data object missing required properties for price slider:', data);
            return; // Exit function if data is not correct
        }
    }

    if (sliderSettings) {
        noUiSlider.create(slider, sliderSettings);
    } else {
        console.error('Slider settings not defined due to missing or incorrect data');
    }

    if (slider && slider.noUiSlider) {
        slider.noUiSlider.on('update', function(values) {
            // Check if the slider is for price and handle it accordingly
            if (column === 'price') {
                appState.filterState[column] = {
                    value: parseFloat(values[0].replace('$', ''))
                };
            } else {
                // Ensure both values are available for range sliders
                appState.filterState[column] = {
                    start: parseFloat(values[0].replace('$', '')),
                    end: parseFloat(values[1] ? values[1].replace('$', '') : values[0].replace('$', '')) // Fallback to start if end is not available
                };
            }
            logFilterState(); // Log the current filter state
            applyFilters(); // Apply the filters to the table
        });               
    } else {
        console.error('Failed to create slider for column:', column);
    }
    
}

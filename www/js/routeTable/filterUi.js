// Importing necessary functionality
import { appState } from '../stateManager.js';  // Assuming state manager handles global state
import { logFilterState } from './tableFilter.js';

export function createFilterPopup(column, event) {
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

    const data = determineDataByColumn(column);
    positionPopup(filterPopup, event);
    initializeSlider(filterPopup, column, data);
}

function determineDataByColumn(column) {
    // Assuming data for times are converted to decimal and managed in appState
    switch(column) {
        case 'price':
            return {
                min: Math.min(...appState.priceData),
                max: Math.max(...appState.priceData),
                median: (Math.min(...appState.priceData) + Math.max(...appState.priceData)) / 2
            };
        case 'departure':
        case 'arrival':
            // Assuming times are converted from specific data entries to decimal and managed in appState
            return {
                minTime: 0,
                maxTime: 24,
                medianTime: 12
            };
        default:
            return { min: 0, max: 100, median: 50 }; // Default or error handling
    }
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
        // Ensure that data has the required properties before using them
        if (data && data.hasOwnProperty('median') && data.hasOwnProperty('min') && data.hasOwnProperty('max')) {
            sliderSettings = {
                start: [data.median],
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
        slider.noUiSlider.on('update', function(values, handle) {
            appState.filterState[column] = { value: parseFloat(values[handle].replace('$', '')) };
            logFilterState(); // Log the current filter state
        });
    } else {
        console.error('Failed to create slider for column:', column);
    }
    
}

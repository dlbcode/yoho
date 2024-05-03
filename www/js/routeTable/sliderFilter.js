import { appState } from '../stateManager.js';  // Assuming state manager handles global state
import { logFilterState, applyFilters, toggleFilterResetIcon } from './filterTable.js';

appState.filterState = {
    departure: { start: 0, end: 24 },
    arrival: { start: 0, end: 24 }
};

const sliderFilter = {
    loadNoUiSlider: function(data) {
        if (!window.noUiSlider) {
            const script = document.createElement('script');
            script.src = "https://cdn.jsdelivr.net/npm/nouislider/distribute/nouislider.min.js";
            document.head.appendChild(script);
            const link = document.createElement('link');
            link.rel = "stylesheet";
            link.href = "https://cdn.jsdelivr.net/npm/nouislider/distribute/nouislider.min.css";
            document.head.appendChild(link);
        }
    },

    updateSliderRange: function(slider, newMin, newMax, isDualHandle = true) {
        const startValues = isDualHandle ? [newMin, newMax] : [newMax];
    
        slider.noUiSlider.updateOptions({
            range: {
                'min': newMin,
                'max': newMax
            },
            start: startValues
        });
    },       

    createFilterPopup: function(column, data, event) {
        const existingPopup = document.getElementById(`${column}FilterPopup`);
        console.log('Existing popup:', existingPopup, 'Event:', event.target);
        if (existingPopup) {
            if (!existingPopup.contains(event.target)) {
                console.log('Toggling existing popup:', existingPopup);
                existingPopup.classList.toggle('hidden');
            }
            if (!existingPopup.classList.contains('hidden')) {
                const slider = existingPopup.querySelector(`#${column}Slider`);
                const filterValues = appState.filterState[column];
                // Check if the filter values are null and reset to default if necessary
                if (slider) {
                    if (filterValues) {
                        // Adjust based on whether the filter is a range or a single value
                        if (filterValues.hasOwnProperty('start')) {
                            slider.noUiSlider.set([filterValues.start, filterValues.end]);
                        } else {
                            slider.noUiSlider.set([filterValues.value]);
                        }
                    } else {
                        // Reset to default values, e.g., the whole range or the mid-point for single handle sliders
                        if (data.hasOwnProperty('start')) {
                            slider.noUiSlider.set([data.min, data.max]);
                        } else {
                            slider.noUiSlider.set([data.max]);
                        }
                    }
                }
                sliderFilter.positionPopup(existingPopup, event);  // Update position every time it's shown
            }
            return;
        }

        const filterPopup = document.createElement('div');
        filterPopup.id = `${column}FilterPopup`;
        filterPopup.className = 'filter-popup';
        document.body.appendChild(filterPopup);

        const valueLabel = document.createElement('div');
        valueLabel.id = `${column}ValueLabel`;
        valueLabel.className = 'filter-value-label';
        filterPopup.appendChild(valueLabel);

        if (!data) {
            console.error('No data provided for filtering:', column);
            return; // Do not proceed if no data is provided
        }

        sliderFilter.positionPopup(filterPopup, event);  // Initial position setting
        sliderFilter.initializeSlider(filterPopup, column, data, valueLabel);

        document.addEventListener('click', function (e) {
            if (!filterPopup.contains(e.target) && e.target !== filterPopup && e.target !== event.target) {
                filterPopup.classList.add('hidden');
            }
        }, true);

        document.addEventListener('click', function (e) {
            const existingPopup = document.getElementById(`${column}FilterPopup`);
            if (existingPopup && !existingPopup.contains(e.target) && e.target !== existingPopup) {
                existingPopup.classList.add('hidden');
                toggleFilterResetIcon(column); // Make sure this function is called here
            }
        }, true);      
    },    

    positionPopup: function(popup, event) {
        if (!event || !event.target) {
            console.error('Event or event target is undefined in positionPopup.');
            return;
        }
        const iconRect = event.target.getBoundingClientRect();
        popup.style.left = `${iconRect.left + window.scrollX}px`;
        popup.style.top = `${iconRect.top + window.scrollY - 90}px`; // Position above the icon
    },

    initializeSlider: function(popup, column, data, valueLabel) {
        const slider = document.createElement('div');
        slider.id = `${column}Slider`;
        popup.appendChild(slider);

        let sliderSettings;
        if (column === 'departure' || column === 'arrival') {
            sliderSettings = {
                start: [data.min || 0, data.max || 24],
                connect: true,
                range: {
                    'min': 0,
                    'max': 24
                },
                step: 0.5,
                tooltips: [true, true].map(() => ({
                    to: function(value) {
                        const hours = Math.floor(value);
                        const minutes = Math.floor((value % 1) * 60);
                        const period = hours < 12 || hours === 24 ? 'AM' : 'PM';
                        const displayHours = hours % 12 === 0 ? 12 : hours % 12;
                        return `${displayHours}:${minutes < 10 ? '0' + minutes : minutes} ${period}`;
                    },
                    from: function(value) {
                        return parseFloat(value);
                    }
                }))
            };
        } else if (column === 'price') {
            if (data && data.hasOwnProperty('min') && data.hasOwnProperty('max')) {
                sliderSettings = {
                    start: data.max,
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
            const handles = slider.querySelectorAll('.noUi-handle');
            handles.forEach(handle => handle.classList.add('slider-handle'));
            slider.noUiSlider.on('update', function(values) {
                sliderFilter.updateFilterStateAndLabel(column, values, valueLabel);
            });
        } else {
            console.error('Slider settings not defined due to missing or incorrect data');
        }
    },

    formatTime: function(value) {
        const hours = Math.floor(value);
        const minutes = Math.floor((value % 1) * 60);
        const period = hours < 12 || hours === 24 ? 'AM' : 'PM';
        const displayHours = hours % 12 === 0 ? 12 : hours % 12;
        return `${displayHours}:${minutes < 10 ? '0' + minutes : minutes} ${period}`;
    },

    updateFilterStateAndLabel: function(column, values, label) {
        if (column === 'price') {
            appState.filterState[column] = { value: parseFloat(values[0].replace('$', '')) };
            label.textContent = `Max price: $${appState.filterState[column].value}`;
        } else {
                const start = parseFloat(values[0]);
                const end = parseFloat(values[1] ? values[1] : values[0]);
                appState.filterState[column] = { start: start, end: end };
                if (start === 0 && end === 24) {
                    label.textContent = 'Anytime';
                } else {
                    label.textContent = `Departure: ${this.formatTime(start)} - ${this.formatTime(end)}`;
                }
            }
        logFilterState();
        applyFilters();
    }
}

document.addEventListener('DOMContentLoaded', function() {
    sliderFilter.loadNoUiSlider();
});

export { sliderFilter };

import { appState } from '../stateManager.js';
import { logFilterState, applyFilters, toggleFilterResetIcon, updateFilterHeaders } from './filterTable.js';

appState.filterState = {
    departure: { start: 0, end: 24 },
    arrival: { start: 0, end: 24 }
};

const sliderFilter = {
    loadNoUiSlider: function (data) {
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

    updateSliderRange: function (slider, newMin, newMax, isDualHandle = true) {
        const startValues = isDualHandle ? [newMin, newMax] : [newMax];

        slider.noUiSlider.updateOptions({
            range: {
                'min': newMin,
                'max': newMax
            },
            start: startValues
        });
    },

    createFilterPopup: function (column, data, event) {
        const existingPopup = document.getElementById(`${column}FilterPopup`);
        if (existingPopup) {
            // Toggle visibility based on current state
            existingPopup.classList.toggle('hidden');
            if (!existingPopup.classList.contains('hidden')) {
                this.updatePopupValues(existingPopup, column, data);
            }
        } else {
            // Create the popup since it does not exist
            this.createAndShowPopup(column, data, event);
        }
    },

    updatePopupValues: function (popup, column, data) {
        const slider = popup.querySelector(`#${column}Slider`);
        const filterValues = appState.filterState[column];
        if (slider) {
            if (filterValues) {
                // Set slider to existing filter values or default
                slider.noUiSlider.set(filterValues.hasOwnProperty('start') ?
                    [filterValues.start, filterValues.end] : [filterValues.value]);
            } else {
                // Reset slider to default values
                slider.noUiSlider.set(data.hasOwnProperty('start') ?
                    [data.min, data.max] : [data.max]);
            }
        }
        sliderFilter.positionPopup(popup, event);
    },

    createAndShowPopup: function (column, data, event) {
        if (!data) {
            console.error('No data provided for filtering:', column);
            return;
        }

        // First remove any existing popup
        const existingPopup = document.getElementById(`${column}FilterPopup`);
        if (existingPopup) {
            existingPopup.remove();
        }

        // Ensure filter icon exists
        let filterIcon = document.getElementById(`${column}Filter`);
        if (!filterIcon) {
            // Create filter icon if missing
            filterIcon = document.createElement('span');
            filterIcon.id = `${column}Filter`;
            filterIcon.className = 'filterIcon';
            filterIcon.setAttribute('data-column', column);
            
            // Find header cell to append to
            const headerCell = document.querySelector(`th[data-column="${column}"]`);
            if (headerCell) {
                headerCell.appendChild(filterIcon);
            }
        }

        // Create reset icon if missing
        let resetIcon = document.getElementById(`reset${column.charAt(0).toUpperCase() + column.slice(1)}Filter`);
        if (!resetIcon) {
            resetIcon = document.createElement('span');
            resetIcon.id = `reset${column.charAt(0).toUpperCase() + column.slice(1)}Filter`;
            resetIcon.className = 'resetIcon';
            resetIcon.setAttribute('data-column', column);
            resetIcon.style.display = 'none';
            
            const headerCell = document.querySelector(`th[data-column="${column}"]`);
            if (headerCell) {
                headerCell.appendChild(resetIcon);
            }
        }

        // Continue with existing popup creation code...
        const filterPopup = document.createElement('div');
        filterPopup.id = `${column}FilterPopup`;
        filterPopup.className = 'filter-popup';
        document.body.appendChild(filterPopup);

        // Create label
        const label = document.createElement('span');
        label.innerHTML = column;
        label.textContent = label.textContent.charAt(0).toUpperCase() + label.textContent.slice(1);
        label.className = 'popup-label';
        filterPopup.appendChild(label);

        const closeButton = document.createElement('span');
        closeButton.innerHTML = '✕';
        closeButton.className = 'popup-close-button';
        closeButton.addEventListener('click', function () {
            filterPopup.classList.add('hidden');
        });
        filterPopup.appendChild(closeButton);

        const valueLabel = document.createElement('div');
        valueLabel.id = `${column}ValueLabel`;
        valueLabel.className = 'filter-value-label';
        filterPopup.appendChild(valueLabel);

        sliderFilter.positionPopup(filterPopup, event);
        sliderFilter.initializeSlider(filterPopup, column, data, valueLabel);

        document.addEventListener('click', (e) => {
            const existingPopup = document.getElementById(`${column}FilterPopup`);
            if (!filterPopup.contains(e.target) && e.target !== filterPopup && e.target !== event.target) {
                filterPopup.classList.add('hidden');
            }
            toggleFilterResetIcon(column);
        }, true);
    },

    positionPopup: function (popup, event) {
        if (!event || !event.target) {
            console.error('Event or event target is undefined in positionPopup.');
            return;
        }
        const iconRect = event.target.getBoundingClientRect();
        const popupWidth = popup.offsetWidth;
        const screenPadding = 10; // Padding from edge of the screen

        // Calculate left position to ensure the popup doesn't overflow the screen
        let leftPosition = iconRect.left + window.scrollX;
        if (leftPosition + popupWidth > window.innerWidth - screenPadding) {
            leftPosition = window.innerWidth - popupWidth - screenPadding;
        } else if (leftPosition < screenPadding) {
            leftPosition = screenPadding;
        }

        popup.style.left = `${leftPosition}px`;
        popup.style.top = `${iconRect.top + window.scrollY - 90}px`; // Position above the icon
    },

    initializeSlider: function (popup, column, data, valueLabel) {
        const slider = document.createElement('div');
        slider.id = `${column}Slider`;
        popup.appendChild(slider);

        let sliderSettings = this.getSliderSettings(column, data);

        if (sliderSettings) {
            noUiSlider.create(slider, sliderSettings);
            const handles = slider.querySelectorAll('.noUi-handle');
            handles.forEach(handle => handle.classList.add('slider-handle'));
            slider.noUiSlider.on('update', function (values) {
                sliderFilter.updateFilterStateAndLabel(column, values, valueLabel);
                applyFilters(); // Re-filter rows when the slider is updated
                updateFilterHeaders(); //update headers
            });
            slider.addEventListener('touchend', function () {
                toggleFilterResetIcon(column);
            });
        } else {
            console.error('Slider settings not defined due to missing or incorrect data');
        }
    },

    getSliderSettings: function (column, data) {
        if (column === 'departure' || column === 'arrival') {
            return {
                start: [data.min || 0, data.max || 24],
                connect: true,
                range: {
                    'min': 0,
                    'max': 24
                },
                step: 0.5,
                tooltips: [this.createTooltip(true), this.createTooltip(true)]
            };
        } else if (column === 'price' && data && data.hasOwnProperty('min') && data.hasOwnProperty('max')) {
            return {
                start: data.max,
                range: {
                    'min': data.min,
                    'max': data.max
                },
                step: 1,
                tooltips: this.createTooltip(false),
                format: {
                    to: function (value) {
                        return `$${Math.round(value)}`;
                    },
                    from: function (value) {
                        return Number(value.replace('$', ''));
                    }
                }
            };
        }
        console.error('Unsupported column or missing data for slider:', column, data);
        return null;
    },

    createTooltip: function (isTime) {
        return {
            to: function (value) {
                return isTime ? sliderFilter.formatTime(value) : `$${Math.round(value)}`;
            },
            from: function (value) {
                return isTime ? value : parseFloat(value.replace('$', ''));
            }
        };
    },

    formatTime: function (value) {
        const hours = Math.floor(value);
        const minutes = Math.floor((value % 1) * 60);
        const period = hours < 12 || hours === 24 ? 'AM' : 'PM';
        const displayHours = hours % 12 === 0 ? 12 : hours % 12;
        return `${displayHours}:${minutes < 10 ? '0' + minutes : minutes} ${period}`;
    },

    updateFilterStateAndLabel: function (column, values, label) {
        if (column === 'price') {
            appState.filterState[column] = { value: parseFloat(values[0].replace('$', '')) };
            label.textContent = `up to: $${appState.filterState[column].value}`;
        } else {
            const start = parseFloat(values[0]);
            const end = parseFloat(values[1] ? values[1] : values[0]);
            appState.filterState[column] = { start: start, end: end };
            if (start === 0 && end === 24) {
                label.textContent = 'Anytime';
            } else {
                label.textContent = `${this.formatTime(start)} - ${this.formatTime(end)}`;
            }
        }
        logFilterState();
        applyFilters();
    }
}

document.addEventListener('DOMContentLoaded', function () {
    sliderFilter.loadNoUiSlider();
});

export { sliderFilter };
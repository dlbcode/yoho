import { appState } from '../stateManager.js';
import { applyFilters, toggleFilterResetIcon, updateFilterHeaders, updateFilterState } from './filterDeck.js';

appState.filterState = {
    departure: { start: 0, end: 24 },
    arrival: { start: 0, end: 24 }
};

const sliderFilter = {
    loadNoUiSlider: function () {
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
        slider.noUiSlider.updateOptions({
            range: { 'min': newMin, 'max': newMax },
            start: isDualHandle ? [newMin, newMax] : [newMax]
        });
    },

    createFilterPopup: function (filterType, data, event) {
        // Toggle behavior - check if we're clicking on the same filter that has an open popup
        const existingPopup = document.getElementById(`${filterType}FilterPopup`);
        const clickedElement = event.target;
        const isFilterElement = clickedElement.getAttribute('data-filter') === filterType || 
                              clickedElement.closest(`[data-filter="${filterType}"]`);
        
        if (existingPopup && isFilterElement) {
            // If clicking the same filter button that created this popup, close it
            existingPopup.classList.add('hidden');
            setTimeout(() => existingPopup.remove(), 300);
            toggleFilterResetIcon(filterType); // Ensure reset icon is shown if filter is active
            return;
        }
        
        // Remove any existing popups
        document.querySelectorAll('.filter-popup').forEach(popup => {
            popup.classList.add('hidden');
            setTimeout(() => popup.remove(), 300);
        });

        // Create new popup
        this.createAndShowPopup(filterType, data, event);
    },

    updatePopupValues: function (popup, filterType, data) {
        const slider = popup.querySelector(`#${filterType}Slider`);
        if (!slider || !slider.noUiSlider) return;

        if (filterType === 'price') {
            const currentValue = appState.filterState?.price?.value;
            // Set to max price when no filter is applied
            const value = currentValue !== null ? currentValue : data.max;
            slider.noUiSlider.set(value);
        } else {
            const filterValues = appState.filterState[filterType];
            const defaultValues = [data.min, data.max];
            const values = filterValues ? [filterValues.start, filterValues.end] : defaultValues;
            slider.noUiSlider.set(values);
        }
    },

    createAndShowPopup: function (filterType, data, event) {
        if (!data) return console.error('No data provided for filtering:', filterType);

        const existingPopup = document.getElementById(`${filterType}FilterPopup`);
        
        // If popup already exists, just close it and return
        if (existingPopup) {
            existingPopup.classList.add('hidden');
            setTimeout(() => existingPopup.remove(), 300);
            return;
        }

        let filterIcon = document.getElementById(`${filterType}Filter`);
        if (!filterIcon) {
            filterIcon = document.createElement('span');
            filterIcon.id = `${filterType}Filter`;
            filterIcon.className = 'filterIcon';
            filterIcon.setAttribute('data-filter', filterType);
            document.querySelector(`[data-filter="${filterType}"]`)?.appendChild(filterIcon);
        }

        let resetIcon = document.getElementById(`reset${filterType.charAt(0).toUpperCase() + filterType.slice(1)}Filter`);
        if (!resetIcon) {
            resetIcon = document.createElement('span');
            resetIcon.id = `reset${filterType.charAt(0).toUpperCase() + filterType.slice(1)}Filter`;
            resetIcon.className = 'resetIcon';
            resetIcon.setAttribute('data-filter', filterType);
            resetIcon.style.display = 'none';
            document.querySelector(`[data-filter="${filterType}"]`)?.appendChild(resetIcon);
        }

        const filterPopup = document.createElement('div');
        filterPopup.id = `${filterType}FilterPopup`;
        filterPopup.className = 'filter-popup';
        document.body.appendChild(filterPopup);

        const label = document.createElement('span');
        label.textContent = filterType.charAt(0).toUpperCase() + filterType.slice(1);
        label.className = 'popup-label';
        filterPopup.appendChild(label);

        const closeButton = document.createElement('span');
        closeButton.innerHTML = '✕';
        closeButton.className = 'popup-close-button';
        closeButton.addEventListener('click', () => filterPopup.classList.add('hidden'));
        filterPopup.appendChild(closeButton);

        const valueLabel = document.createElement('div');
        valueLabel.id = `${filterType}ValueLabel`;
        valueLabel.className = 'filter-value-label';
        filterPopup.appendChild(valueLabel);

        this.positionPopup(filterPopup, event);
        this.initializeSlider(filterPopup, filterType, data, valueLabel);

        // After slider initialization, update with current values from state
        setTimeout(() => {
            this.restoreFilterValues(filterPopup, filterType);
        }, 0);

        document.addEventListener('click', (e) => {
            if (!filterPopup.contains(e.target) && e.target !== event.target) {
                filterPopup.classList.add('hidden');
            }
            toggleFilterResetIcon(filterType);
        }, true);
    },

    positionPopup: function (popup, event) {
        if (!event?.target) return console.error('Event or event target is undefined in positionPopup.');
        const iconRect = event.target.getBoundingClientRect();
        const popupWidth = popup.offsetWidth;
        const screenPadding = 10;

        let leftPosition = iconRect.left + window.scrollX;
        if (leftPosition + popupWidth > window.innerWidth - screenPadding) {
            leftPosition = window.innerWidth - popupWidth - screenPadding;
        } else if (leftPosition < screenPadding) {
            leftPosition = screenPadding;
        }

        popup.style.left = `${leftPosition}px`;
        popup.style.top = `${iconRect.top + window.scrollY - 100}px`;
    },

    initializeSlider: function (popup, filterType, data, valueLabel) {
        const slider = document.createElement('div');
        slider.id = `${filterType}Slider`;
        popup.appendChild(slider);

        const sliderSettings = this.getSliderSettings(filterType, data);
        if (sliderSettings) {
            noUiSlider.create(slider, sliderSettings);
            slider.querySelectorAll('.noUi-handle').forEach(handle => handle.classList.add('slider-handle'));
            slider.noUiSlider.on('update', (values) => {
                this.updateFilterStateAndLabel(filterType, values, valueLabel);
                applyFilters();
                updateFilterHeaders();
            });
            slider.addEventListener('touchend', () => toggleFilterResetIcon(filterType));
        } else {
            console.error('Slider settings not defined due to missing or incorrect data');
        }
    },

    getSliderSettings: function (filterType, data) {
        if (['departure', 'arrival'].includes(filterType)) {
            // Read current values from filter state if available
            const currentValues = appState.filterState?.[filterType];
            const start = currentValues ? [currentValues.start, currentValues.end] : [data.min || 0, data.max || 24];
            
            return {
                start: start,
                connect: true,
                range: { 'min': 0, 'max': 24 },
                step: 1,
                tooltips: [this.createTooltip(true), this.createTooltip(true)]
            };
        } else if (filterType === 'price' && data?.min !== undefined && data?.max !== undefined) {
            // Add buffer when min equals max
            const actualMax = data.max;
            const sliderMax = data.min === data.max ? data.max + Math.max(1, data.max * 0.1) : data.max;
            
            // Changed this part - start from actualMax when value is null
            const currentValue = appState.filterState?.price?.value;
            const startValue = currentValue !== null ? currentValue : actualMax;
            
            return {
                start: startValue,
                range: { 'min': data.min, 'max': sliderMax },
                step: 1,
                tooltips: this.createTooltip(false),
                format: {
                    to: (value) => `$${Math.round(Math.min(value, actualMax))}`,
                    from: (value) => Number(value.replace('$', ''))
                }
            };
        }
        console.error('Unsupported filter or missing data for slider:', filterType, data);
        return null;
    },

    createTooltip: function (isTime) {
        return {
            to: (value) => isTime ? this.formatTime(value) : `$${Math.round(value)}`,
            from: (value) => isTime ? value : parseFloat(value.replace('$', ''))
        };
    },

    formatTime: function (value) {
        const hours = Math.floor(value);
        const period = hours < 12 || hours === 24 ? 'AM' : 'PM';
        const displayHours = hours % 12 === 0 ? 12 : hours % 12;
        return `${displayHours}${period}`;
    },

    updateFilterStateAndLabel: function (filterType, values, label) {
        let newValues;
        let labelText;
        const filterButton = document.querySelector(`[data-filter="${filterType}"]`);
        const filterHeader = filterButton?.querySelector('.filter-text');

        if (filterType === 'price') {
            const priceValue = parseFloat(values[0].replace('$', ''));
            newValues = { value: priceValue };
            labelText = `up to: $${priceValue}`;
            // Update the filter button text
            if (filterHeader) {
                filterHeader.innerHTML = `<span class="filter-label">Up to:</span> $${priceValue}`;
            }
        } else {
            const [start, end] = values.map(parseFloat);
            newValues = { start, end: end || start };
            
            // Format time values in 12-hour format with lowercase am/pm
            const formatTimeAmPm = (value) => {
                const hours = Math.floor(value);
                const period = hours < 12 || hours === 24 ? 'am' : 'pm';
                const displayHours = hours % 12 === 0 ? 12 : hours % 12;
                return `${displayHours}${period}`;
            };

            labelText = (start === 0 && end === 24) ? 'Anytime' :
                `${formatTimeAmPm(start)} - ${formatTimeAmPm(end)}`;

            // Update the filter button text for both arrival and departure
            if (filterHeader) {
                if (filterType === 'arrival') {
                    filterHeader.innerHTML = `<span class="filter-label">Arrive:</span> ${labelText}`;
                } else if (filterType === 'departure') {
                    filterHeader.innerHTML = `<span class="filter-label">Depart:</span> ${labelText}`;
                }
            }
        }

        label.textContent = labelText;
        updateFilterState(filterType, newValues);
    },

    // Add new function to restore filter values
    restoreFilterValues: function(popup, filterType) {
        const slider = popup.querySelector(`#${filterType}Slider`);
        const valueLabel = popup.querySelector(`#${filterType}ValueLabel`);
        
        if (!slider || !slider.noUiSlider) return;
        
        // Get current filter values from state
        const filterValues = appState.filterState?.[filterType];
        
        if (filterType === 'price') {
            const currentValue = filterValues?.value;
            if (currentValue !== null && currentValue !== undefined) {
                slider.noUiSlider.set(currentValue);
            }
        } else if (['departure', 'arrival'].includes(filterType) && filterValues) {
            slider.noUiSlider.set([filterValues.start, filterValues.end]);
            
            // Update value label
            if (valueLabel) {
                const start = filterValues.start;
                const end = filterValues.end;
                
                const formatTimeAmPm = (value) => {
                    const hours = Math.floor(value);
                    const period = hours < 12 || hours === 24 ? 'am' : 'pm';
                    const displayHours = hours % 12 === 0 ? 12 : hours % 12;
                    return `${displayHours}${period}`;
                };
                
                const labelText = (start === 0 && end === 24) ? 'Anytime' :
                    `${formatTimeAmPm(start)} - ${formatTimeAmPm(end)}`;
                    
                valueLabel.textContent = labelText;
            }
        }
    }
};

document.addEventListener('DOMContentLoaded', () => sliderFilter.loadNoUiSlider());

export { sliderFilter };
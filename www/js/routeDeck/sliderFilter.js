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

    createFilterPopup: function (column, data, event) {
        let popup = document.getElementById(`${column}FilterPopup`);
        if (popup) {
            popup.classList.toggle('hidden');
            if (!popup.classList.contains('hidden')) this.updatePopupValues(popup, column, data);
        } else {
            this.createAndShowPopup(column, data, event);
        }
    },

    updatePopupValues: function (popup, column, data) {
        const slider = popup.querySelector(`#${column}Slider`);
        const filterValues = appState.filterState[column];
        if (slider) {
            slider.noUiSlider.set(filterValues ? [filterValues.start, filterValues.end] : [data.min, data.max]);
        }
        this.positionPopup(popup, event);
    },

    createAndShowPopup: function (column, data, event) {
        if (!data) return console.error('No data provided for filtering:', column);

        document.getElementById(`${column}FilterPopup`)?.remove();

        let filterIcon = document.getElementById(`${column}Filter`);
        if (!filterIcon) {
            filterIcon = document.createElement('span');
            filterIcon.id = `${column}Filter`;
            filterIcon.className = 'filterIcon';
            filterIcon.setAttribute('data-column', column);
            document.querySelector(`th[data-column="${column}"]`)?.appendChild(filterIcon);
        }

        let resetIcon = document.getElementById(`reset${column.charAt(0).toUpperCase() + column.slice(1)}Filter`);
        if (!resetIcon) {
            resetIcon = document.createElement('span');
            resetIcon.id = `reset${column.charAt(0).toUpperCase() + column.slice(1)}Filter`;
            resetIcon.className = 'resetIcon';
            resetIcon.setAttribute('data-column', column);
            resetIcon.style.display = 'none';
            document.querySelector(`th[data-column="${column}"]`)?.appendChild(resetIcon);
        }

        const filterPopup = document.createElement('div');
        filterPopup.id = `${column}FilterPopup`;
        filterPopup.className = 'filter-popup';
        document.body.appendChild(filterPopup);

        const label = document.createElement('span');
        label.textContent = column.charAt(0).toUpperCase() + column.slice(1);
        label.className = 'popup-label';
        filterPopup.appendChild(label);

        const closeButton = document.createElement('span');
        closeButton.innerHTML = '✕';
        closeButton.className = 'popup-close-button';
        closeButton.addEventListener('click', () => filterPopup.classList.add('hidden'));
        filterPopup.appendChild(closeButton);

        const valueLabel = document.createElement('div');
        valueLabel.id = `${column}ValueLabel`;
        valueLabel.className = 'filter-value-label';
        filterPopup.appendChild(valueLabel);

        this.positionPopup(filterPopup, event);
        this.initializeSlider(filterPopup, column, data, valueLabel);

        document.addEventListener('click', (e) => {
            if (!filterPopup.contains(e.target) && e.target !== event.target) {
                filterPopup.classList.add('hidden');
            }
            toggleFilterResetIcon(column);
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
        popup.style.top = `${iconRect.top + window.scrollY - 90}px`;
    },

    initializeSlider: function (popup, column, data, valueLabel) {
        const slider = document.createElement('div');
        slider.id = `${column}Slider`;
        popup.appendChild(slider);

        const sliderSettings = this.getSliderSettings(column, data);
        if (sliderSettings) {
            noUiSlider.create(slider, sliderSettings);
            slider.querySelectorAll('.noUi-handle').forEach(handle => handle.classList.add('slider-handle'));
            slider.noUiSlider.on('update', (values) => {
                this.updateFilterStateAndLabel(column, values, valueLabel);
                applyFilters();
                updateFilterHeaders();
            });
            slider.addEventListener('touchend', () => toggleFilterResetIcon(column));
        } else {
            console.error('Slider settings not defined due to missing or incorrect data');
        }
    },

    getSliderSettings: function (column, data) {
        if (['departure', 'arrival'].includes(column)) {
            return {
                start: [data.min || 0, data.max || 24],
                connect: true,
                range: { 'min': 0, 'max': 24 },
                step: 0.5,
                tooltips: [this.createTooltip(true), this.createTooltip(true)]
            };
        } else if (column === 'price' && data?.min !== undefined && data?.max !== undefined) {
            // Add buffer when min equals max
            const actualMax = data.max;
            const sliderMax = data.min === data.max ? data.max + Math.max(1, data.max * 0.1) : data.max;
            
            return {
                start: actualMax,
                range: { 'min': data.min, 'max': sliderMax },
                step: 1,
                tooltips: this.createTooltip(false),
                format: {
                    to: (value) => `$${Math.round(Math.min(value, actualMax))}`,
                    from: (value) => Number(value.replace('$', ''))
                }
            };
        }
        console.error('Unsupported column or missing data for slider:', column, data);
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
        const minutes = Math.floor((value % 1) * 60);
        const period = hours < 12 || hours === 24 ? 'AM' : 'PM';
        const displayHours = hours % 12 === 0 ? 12 : hours % 12;
        return `${displayHours}:${minutes < 10 ? '0' + minutes : minutes} ${period}`;
    },

    updateFilterStateAndLabel: function (column, values, label) {
        let newValues;
        if (column === 'price') {
            newValues = { value: parseFloat(values[0].replace('$', '')) };
            label.textContent = `up to: $${newValues.value}`;
        } else {
            const [start, end] = values.map(parseFloat);
            newValues = { start, end: end || start };
            label.textContent = (start === 0 && end === 24) ? 'Anytime' : 
                `${this.formatTime(start)} - ${this.formatTime(end)}`;
        }
        
        updateFilterState(column, newValues);
    }
};

document.addEventListener('DOMContentLoaded', () => sliderFilter.loadNoUiSlider());

export { sliderFilter };
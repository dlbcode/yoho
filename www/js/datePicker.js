import { appState, updateState } from './stateManager.js';

export function initDatePicker(inputId, routeNumber) {
    const dateInput = document.getElementById(inputId);
    const fp = flatpickr(dateInput, {
        disableMobile: true,
        enableTime: false,
        dateFormat: "Y-m-d",
        defaultDate: appState.routeDates[routeNumber] || '',
        minDate: routeNumber === 0 ? "today" : appState.routeDates[routeNumber - 1],
        mode: appState.routeDates[routeNumber] && appState.routeDates[routeNumber].includes(' to ') ? 'range' : 'single',
        altInput: true,
        altFormat: "D, d M",
        onValueUpdate: function(selectedDates, dateStr) {
            let dateValue = null;
            if (selectedDates.length > 0) {
                dateValue = selectedDates.map(date => date.toISOString().split('T')[0]).join(' to ');
            }
            updateState('updateRouteDate', { routeNumber, date: dateValue });
        },
        onReady: function(selectedDates, dateStr, instance) {
            instance.calendarContainer.classList.add('do-not-close-routebox');
            const prevMonthButton = instance.calendarContainer.querySelector('.flatpickr-prev-month');
            const dateModeSelectWrapper = document.createElement('div');
            dateModeSelectWrapper.className = 'select-wrapper';
            const dateModeSelect = document.createElement('div');
            dateModeSelect.className = 'date-mode-select';
            const selectedOption = document.createElement('div');
            selectedOption.className = 'selected-option';
            const options = ['Specific Date', 'Date Range', 'Any Dates'];
            const optionsContainer = document.createElement('div');
            optionsContainer.className = 'options';
            optionsContainer.style.display = 'none';  // Initially hide options
            options.forEach(option => {
                const opt = document.createElement('div');
                opt.className = 'option';
                opt.textContent = option;
                opt.onclick = function() {
                    updateDateMode(option, instance, inputId);
                };
                optionsContainer.appendChild(opt);

                dateModeSelect.appendChild(selectedOption)
                .appendChild(optionsContainer);
                dateModeSelectWrapper.appendChild(dateModeSelect);
                prevMonthButton.parentNode.insertBefore(dateModeSelectWrapper, prevMonthButton);

                // Show/hide the options when the dropdown is clicked
                dateModeSelect.addEventListener('click', () => {
                    optionsContainer.style.display = optionsContainer.style.display === 'none' ? 'block' : 'none';
                });

                dateModeSelect.addEventListener('change', () => {
                    const selectedOption = dateModeSelect.querySelector('.selected').textContent;
                    const isAnyDates = selectedOption === 'Any Dates';
                    const isSpecificDate = selectedOption === 'Specific Date';

                    if (isAnyDates) {
                        document.getElementById('depart-date-input').value = 'Any Dates'; // Directly updating the input field's value
                        updateState('updateRouteDate', { routeNumber: routeNumber, date: 'any' });
                        instance.close();
                    } else {
                        const newMode = isSpecificDate ? "single" : "range";
                        instance.set("mode", newMode);
                        this.textContent = newMode === "single" ? 'Select Date' : '[..]';
                        instance.clear();
                        instance.redraw();

                        const today = new Date();
                        const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
                        const dateToSet = newMode === "single" ? today : [today, nextWeek];
                        instance.setDate(dateToSet, true);
                    }
                });
            });
            dateModeSelect.appendChild(selectedOption).appendChild(optionsContainer);
            prevMonthButton.parentNode.insertBefore(dateModeSelectWrapper, prevMonthButton);
        }
    });
    return fp;
}

function updateDateMode(selectedOption, instance, inputId) {
    const dateInput = document.getElementById(inputId);
    const mode = selectedOption === 'Specific Date' ? 'single' : (selectedOption === 'Date Range' ? 'range' : 'any');
    instance.set('mode', mode);
    dateInput.value = selectedOption;
    updateState('updateRouteDate', { date: mode });
}

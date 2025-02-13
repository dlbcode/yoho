import { appState, updateState } from '../stateManager.js';

export function initDatePicker(inputId, routeNumber) {
    const dateType = inputId.split('-')[0]; // 'depart' or 'return'
    if (!appState.routeDates[routeNumber]) {
        appState.routeDates[routeNumber] = { depart: new Date().toISOString().split('T')[0], return: null };
    }
    const currentRouteDate = appState.routeDates[routeNumber][dateType] || '';
    const isDateRange = currentRouteDate.includes(' to ');

    const dateInput = document.getElementById(inputId);
    let fp = flatpickr(dateInput, {
        disableMobile: true,
        enableTime: false,
        dateFormat: "Y-m-d",
        defaultDate: currentRouteDate.split(' to '),
        minDate: routeNumber === 0 ? "today" : appState.routeDates[routeNumber - 1]?.depart || "today",
        mode: currentRouteDate === 'any' ? 'any' : (isDateRange ? 'range' : 'single'),
        altInput: true,
        altFormat: "D, d M", // This will display the date as 'Fri, 10 May'
        static: true, // Make positioning static,
        clickOpens: false, // Disable default click to open behavior
        onValueUpdate: function(selectedDates, dateStr) {
            let dateValue = null;
            if (selectedDates.length > 0) {
                if (selectedDates.length > 1) {
                    dateValue = `${selectedDates[0].toISOString().split('T')[0]} to ${selectedDates[1].toISOString().split('T')[0]}`;
                } else {
                    dateValue = selectedDates[0].toISOString().split('T')[0];
                }
            } else {
                dateValue = 'any';
            }
            appState.routeDates[routeNumber][dateType] = dateValue;
            updateState('updateRouteDate', { routeNumber, ...appState.routeDates[routeNumber] }, 'datePicker.initDatePicker');
        },
        onReady: (selectedDates, dateStr, instance) => {
            const CALENDAR_HEIGHT = 308; // Updated to match your specified height
            const positionCalendar = () => {
                if (!instance.isOpen) return; // Only reposition if calendar is open
                
                const input = instance.altInput;
                const calendar = instance.calendarContainer;
                const inputRect = input.getBoundingClientRect();
                const spaceAbove = inputRect.top;
                const spaceBelow = window.innerHeight - inputRect.bottom;
                
                // Reset any previous positioning
                calendar.style.position = 'fixed';
                calendar.style.left = `${inputRect.left}px`;
                
                if (spaceAbove >= CALENDAR_HEIGHT) {
                    // Show above if there's enough space
                    calendar.style.top = `${inputRect.top - CALENDAR_HEIGHT}px`;
                } else if (spaceBelow >= CALENDAR_HEIGHT) {
                    // Show below if there's enough space
                    calendar.style.top = `${inputRect.bottom}px`;
                } else {
                    // Not enough space below, align to top of viewport
                    calendar.style.top = '0px';
                }
            };

            // Position calendar when opened
            instance.calendarContainer.classList.add('do-not-close-routebox');
            instance._positionCalendar = positionCalendar;
            
            // Debounce the resize handler
            let resizeTimeout;
            const handleResize = () => {
                clearTimeout(resizeTimeout);
                resizeTimeout = setTimeout(positionCalendar, 100);
            };
            
            // Add event listeners for repositioning
            const addEventListeners = () => {
                window.addEventListener('resize', handleResize);
                window.addEventListener('scroll', positionCalendar);
            };

            const removeEventListeners = () => {
                window.removeEventListener('resize', handleResize);
                window.removeEventListener('scroll', positionCalendar);
            };

            addEventListeners();
            
            // Handle cleanup when calendar is closed
            instance.config.onClose.push(() => {
                removeEventListeners();
            });

            instance.config.onOpen.push(() => {
                addEventListeners();
            });

            let prevMonthButton = instance.calendarContainer.querySelector('.flatpickr-prev-month');
            let dateModeSelectWrapper = document.createElement('div');
            dateModeSelectWrapper.className = 'select-wrapper';
            let dateModeSelect = document.createElement('div');
            dateModeSelect.className = 'date-mode-select';
            let selectedOption = document.createElement('div');
            selectedOption.className = 'selected-option';
            let options = ['Specific Date', 'Date Range', 'Any Dates'];
            let optionsContainer = document.createElement('div');
            optionsContainer.style.display = 'none'; // Hide the options by default
            let selectedOptionText = document.createElement('div');
            selectedOptionText.style.paddingLeft = '4px';
            selectedOption.appendChild(selectedOptionText);
            const altInput = instance.altInput;
            if (currentRouteDate === "any") {
                altInput.value = "Any dates"; // Set custom text for 'any' mode
            }

            options.forEach(option => {
                let opt = document.createElement('div');
                opt.style.paddingLeft = '4px';
                opt.className = 'option';
                let optText = document.createElement('div');
                optText.textContent = option;
                opt.appendChild(optText);
                if ((isDateRange && option === 'Date Range') || (!isDateRange && option === 'Specific Date' && currentRouteDate !== 'any') || (currentRouteDate === 'any' && option === 'Any Dates')) {
                    opt.classList.add('selected');
                    selectedOptionText.textContent = option; // Set the text of the selected option
                    opt.style.display = 'none'; // Hide the selected option
                }
                opt.addEventListener('click', (event) => {
                    event.stopPropagation();
                    let previousSelectedOption = optionsContainer.querySelector('.selected');
                    previousSelectedOption.classList.remove('selected');
                    previousSelectedOption.style.display = 'block'; // Show the previously selected option
                    opt.classList.add('selected');
                    selectedOptionText.textContent = opt.textContent;
                    optionsContainer.style.display = 'none';
                    opt.style.display = 'none';
                    dateModeSelect.dispatchEvent(new Event('change'));
                });
                optionsContainer.appendChild(opt);
            });

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
                    const altInput = instance.altInput || document.getElementById('date-input');
                    appState.routeDates[routeNumber][dateType] = 'any';
                    updateState('updateRouteDate', { routeNumber, ...appState.routeDates[routeNumber] }, 'datePicker.initDatePicker');
                    instance.clear(); // Clear any selected dates in flatpickr
                    instance.close(); // Optionally close the flatpickr calendar
                    altInput.value = 'Any Dates';  // Directly set the displayed input value
                } else {
                    const newMode = isSpecificDate ? "single" : "range";
                    instance.set("mode", newMode);
                    instance.clear();
                    instance.redraw();

                    const today = new Date();
                    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
                    const dateToSet = newMode === "single" ? today : [today, nextWeek];
                    instance.setDate(dateToSet, true); // Set a valid date
                }
            });

            // Add click handler to alt input to toggle calendar
            instance.altInput.addEventListener('click', (e) => {
                if (instance.isOpen) {
                    instance.close();
                } else {
                    instance.open();
                }
            });
        },
        onOpen: function(selectedDates, dateStr, instance) {
            // Call the positioning function when calendar opens
            if (instance._positionCalendar) {
                instance._positionCalendar();
            }
        }
    });
}

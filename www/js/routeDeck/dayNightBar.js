import { flightMap } from "../flightMap.js";

// Determine if it's daytime (between 6AM and 6PM) at a given time
function isDaytime(date) {
    return date.getHours() >= 6 && date.getHours() < 18;
}

function calculateTransitions(departureDate, arrivalDate, durationHours, segment) {
    const flightDuration = durationHours * 60 * 60 * 1000;
    const timeDiff = arrivalDate - departureDate;
    const crossesMidnight = departureDate.getDate() !== arrivalDate.getDate();
    
    // Add geographic check to prevent false IDL crossings
    const isDayLineCrossing = (() => {
        // Get origin and destination data
        const origin = flightMap.airportDataCache[segment.flyFrom];
        const destination = flightMap.airportDataCache[segment.flyTo];
        
        // If we have geographic data, check if the flight actually crosses the IDL
        if (origin && destination) {
            // IDL is approximately at 180° longitude
            const crossesIDL = 
                (origin.longitude < 0 && destination.longitude > 150) || 
                (origin.longitude > 150 && destination.longitude < 0);
                
            // Only return true if we have a significant time difference AND geographic evidence
            return crossesIDL && (
                (timeDiff > flightDuration * 1.5 && durationHours < 24) || 
                (timeDiff < 0 && durationHours < 24)
            );
        }
        
        // Fall back to time-based detection if we don't have geographic data
        return (timeDiff > flightDuration * 1.5 && durationHours < 24) || 
               (timeDiff < 0 && durationHours < 24);
    })();

    const transitions = [];
    // IDL transition
    if (isDayLineCrossing) {
        transitions.push({
            positionPercent: 70,
            label: 'IDL +1',
            labelClass: 'idl-label',
            lineClass: 'idl-transition-line'
        });
    }
    // Midnight transition
    if (crossesMidnight && (!isDayLineCrossing || timeDiff > 0)) {
        let timeToMidnight = new Date(departureDate).setHours(24, 0, 0, 0) - departureDate;
        if (timeToMidnight <= 0 || timeToMidnight >= flightDuration) {
            timeToMidnight = flightDuration * 0.5;
        }
        let midnightPositionPercent = (timeToMidnight / flightDuration) * 100;
        if (isDayLineCrossing && Math.abs(midnightPositionPercent - 70) < 15) {
            midnightPositionPercent = midnightPositionPercent < 70
                ? Math.max(10, midnightPositionPercent - 15)
                : Math.min(90, midnightPositionPercent + 15);
        }
        transitions.push({
            positionPercent: midnightPositionPercent,
            label: '+1',
            labelClass: 'midnight-label',
            lineClass: 'midnight-transition-line'
        });
    }

    return transitions.map(t => `
        <div class="day-transition" style="left: ${Math.min(90, Math.max(10,t.positionPercent))}%;">
            <div class="${t.lineClass}"></div>
            <div class="${t.labelClass}">${t.label}</div>
        </div>
    `).join('');
}

function calculateLayoverTransitions(arrivalDate, departureDate, layoverDurationHours) {
    const layoverDurationMs = layoverDurationHours * 3600000;
    const transitions = [];
    
    // Check for date boundary crossings (midnight)
    const crossesMidnight = arrivalDate.getDate() !== departureDate.getDate();
    
    // Calculate sunrise/sunset transitions during the layover
    const startHour = arrivalDate.getHours();
    const endHour = departureDate.getHours();
    const startDate = new Date(arrivalDate);
    
    // Check for sunrise (6AM) transition
    if (layoverDurationHours > 2) {  // Only check for longer layovers
        let nextSunrise = new Date(startDate);
        // If we're before 6AM, sunrise is today
        if (startHour < 6) {
            nextSunrise.setHours(6, 0, 0, 0);
        } 
        // Otherwise, sunrise is tomorrow
        else {
            nextSunrise.setDate(nextSunrise.getDate() + 1);
            nextSunrise.setHours(6, 0, 0, 0);
        }
        
        // Only add if sunrise happens during the layover
        if (nextSunrise > arrivalDate && nextSunrise < departureDate) {
            const sunrisePos = ((nextSunrise - arrivalDate) / layoverDurationMs) * 100;
            transitions.push({
                positionPercent: sunrisePos,
                label: 'Sunrise',
                labelClass: 'sunrise-label',
                lineClass: 'sunrise-transition-line'
            });
        }
        
        // Check for sunset (18:00/6PM) transition
        let nextSunset = new Date(startDate);
        // If we're before 6PM, sunset is today
        if (startHour < 18) {
            nextSunset.setHours(18, 0, 0, 0);
        } 
        // Otherwise, sunset is tomorrow
        else {
            nextSunset.setDate(nextSunset.getDate() + 1);
            nextSunset.setHours(18, 0, 0, 0);
        }
        
        // Only add if sunset happens during the layover
        if (nextSunset > arrivalDate && nextSunset < departureDate) {
            const sunsetPos = ((nextSunset - arrivalDate) / layoverDurationMs) * 100;
            transitions.push({
                positionPercent: sunsetPos,
                label: 'Sunset',
                labelClass: 'sunset-label',
                lineClass: 'sunset-transition-line'
            });
        }
    }
    
    // Add midnight transition if needed
    if (crossesMidnight) {
        let timeToMidnight = new Date(arrivalDate).setHours(24, 0, 0, 0) - arrivalDate;
        if (timeToMidnight <= 0 || timeToMidnight >= layoverDurationMs) {
            timeToMidnight = layoverDurationMs * 0.5;
        }
        const midnightPos = (timeToMidnight / layoverDurationMs) * 100;
        transitions.push({
            positionPercent: midnightPos,
            label: '+1',
            labelClass: 'midnight-label',
            lineClass: 'midnight-transition-line'
        });
    }

    return transitions.map(t => `
        <div class="day-transition" style="left: ${Math.min(90, Math.max(10, t.positionPercent))}%;">
            <div class="${t.lineClass}"></div>
            <div class="${t.labelClass}">${t.label}</div>
        </div>
    `).join('');
}

// Create day/night flight bar visualization
function createDayNightBar(departureDate, arrivalDate, durationHours, segment) {
    const isDepartureDay = isDaytime(departureDate);
    const isArrivalDay = isDaytime(arrivalDate);
    
    // Format duration for display
    const hours = Math.floor(durationHours);
    const minutes = Math.round((durationHours - hours) * 60);
    const durationText = `${hours}h ${minutes}m`;
    
    const transitionsHtml = calculateTransitions(departureDate, arrivalDate, durationHours, segment);
    
    // Determine the CSS class for the bar based on day/night transitions
    const barLineClass = isDepartureDay && isArrivalDay ? 'day-day' : 
                        !isDepartureDay && !isArrivalDay ? 'night-night' : 
                        isDepartureDay ? 'day-night' : 'night-day';
    
    return `
        <div class="flight-day-night-bar">
            <div class="bar-content">
                <div class="bar-endpoint departure-time-indicator ${isDepartureDay ? 'daytime' : 'nighttime'}">
                    <img src="/assets/${isDepartureDay ? 'sun' : 'moon'}.svg" alt="${isDepartureDay ? 'Day' : 'Night'}" class="time-icon">
                </div>
                <div class="bar-line ${barLineClass}">
                    <span class="duration-text">${durationText}</span>
                </div>
                ${transitionsHtml}
                <div class="bar-endpoint arrival-time-indicator ${isArrivalDay ? 'daytime' : 'nighttime'}">
                    <img src="/assets/${isArrivalDay ? 'sun' : 'moon'}.svg" alt="${isArrivalDay ? 'Day' : 'Night'}" class="time-icon">
                </div>
            </div>
        </div>
    `;
}

// Create day/night layover bar visualization
function createLayoverBar(arrivalDate, departureDate, layoverDurationHours) {
    const isArrivalDay = isDaytime(arrivalDate);
    const isDepartureDay = isDaytime(departureDate);
    
    // Format layover duration for display
    const hours = Math.floor(layoverDurationHours);
    const minutes = Math.round((layoverDurationHours - hours) * 60);
    const layoverText = `${hours}h ${minutes}m layover`;
    
    // Format the arrival and departure times
    const arrivalTime = formatTime(arrivalDate);
    const departureTime = formatTime(departureDate);
    
    const transitionsHtml = calculateLayoverTransitions(arrivalDate, departureDate, layoverDurationHours);
    
    // For longer layovers, determine more accurately if we have day-night transitions
    let layoverLineClass;
    
    if (layoverDurationHours > 12) {
        // For layovers > 12 hours, we need to consider day/night cycles
        const startHour = arrivalDate.getHours();
        const endHour = departureDate.getHours();
        const hoursSpan = layoverDurationHours % 24; // Handle multi-day layovers
        
        // Check if we cross the 6AM or 6PM boundaries
        const crossesMorning = (startHour < 6 && endHour >= 6) || (startHour >= 6 && endHour < 6 && layoverDurationHours > 24);
        const crossesEvening = (startHour < 18 && endHour >= 18) || (startHour >= 18 && endHour < 18 && layoverDurationHours > 24);
        
        if (isArrivalDay) {
            // Starting in daytime
            if (isDepartureDay) {
                // Ending in daytime
                if (crossesEvening && crossesMorning) {
                    layoverLineClass = 'layover-day-night-day'; // day -> night -> day
                } else if (crossesEvening) {
                    layoverLineClass = 'layover-day-night'; // day -> night
                } else {
                    layoverLineClass = 'layover-day-day'; // day all the way
                }
            } else {
                // Ending in nighttime
                layoverLineClass = 'layover-day-night'; // day -> night
            }
        } else {
            // Starting in nighttime
            if (isDepartureDay) {
                // Ending in daytime
                layoverLineClass = 'layover-night-day'; // night -> day
            } else {
                // Ending in nighttime
                if (crossesMorning && crossesEvening) {
                    layoverLineClass = 'layover-night-day-night'; // night -> day -> night
                } else if (crossesMorning) {
                    layoverLineClass = 'layover-night-day'; // night -> day
                } else {
                    layoverLineClass = 'layover-night-night'; // night all the way
                }
            }
        }
    } else {
        // For shorter layovers, stick with simple transitions
        layoverLineClass = isArrivalDay && isDepartureDay ? 'layover-day-day' : 
                         !isArrivalDay && !isDepartureDay ? 'layover-night-night' : 
                         isArrivalDay ? 'layover-day-night' : 'layover-night-day';
    }
    
    return `
        <div class="layover-container">
            <div class="layover-wrapper">
                <div class="airline-section layover-spacer">
                    <!-- Empty airline logo space to match flight segment structure -->
                </div>
                <div class="journey-section">
                    <div class="departure-section">
                        <!-- Empty departure section to maintain width -->
                    </div>
                    
                    <div class="route-indicator">
                        <div class="layover-day-night-bar">
                            <div class="bar-content">
                                <span class="layover-start-time">${arrivalTime}</span>
                                <div class="bar-endpoint layover-endpoint ${isArrivalDay ? 'layover-daytime' : 'layover-nighttime'}">
                                    <img src="/assets/${isArrivalDay ? 'sun' : 'moon'}.svg" alt="${isArrivalDay ? 'Day' : 'Night'}" class="time-icon">
                                </div>
                                <div class="bar-line layover-line ${layoverLineClass}">
                                    <span class="layover-duration-text">${layoverText}</span>
                                    ${transitionsHtml}
                                </div>
                                <div class="bar-endpoint layover-endpoint ${isDepartureDay ? 'layover-daytime' : 'layover-nighttime'}">
                                    <img src="/assets/${isDepartureDay ? 'sun' : 'moon'}.svg" alt="${isDepartureDay ? 'Day' : 'Night'}" class="time-icon">
                                </div>
                                <span class="layover-end-time">${departureTime}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="arrival-section">
                        <!-- Empty arrival section to maintain width -->
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Need to add the formatTime function if it's not already imported
function formatTime(date) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export {
    isDaytime,
    calculateTransitions,
    createDayNightBar,
    createLayoverBar,
    formatTime  // Add formatTime to exports if you added it here
};
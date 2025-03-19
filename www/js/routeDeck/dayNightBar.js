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
    
    // Determine the CSS class for the layover bar based on day/night transitions
    const layoverLineClass = isArrivalDay && isDepartureDay ? 'layover-day-day' : 
                           !isArrivalDay && !isDepartureDay ? 'layover-night-night' : 
                           isArrivalDay ? 'layover-day-night' : 'layover-night-day';
    
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
                                <div class="bar-endpoint layover-endpoint ${isArrivalDay ? 'layover-daytime' : 'layover-nighttime'}">
                                    <img src="/assets/${isArrivalDay ? 'sun' : 'moon'}.svg" alt="${isArrivalDay ? 'Day' : 'Night'}" class="time-icon">
                                </div>
                                <div class="bar-line layover-line ${layoverLineClass}">
                                    <span class="layover-duration-text">${layoverText}</span>
                                </div>
                                <div class="bar-endpoint layover-endpoint ${isDepartureDay ? 'layover-daytime' : 'layover-nighttime'}">
                                    <img src="/assets/${isDepartureDay ? 'sun' : 'moon'}.svg" alt="${isDepartureDay ? 'Day' : 'Night'}" class="time-icon">
                                </div>
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

export {
    isDaytime,
    calculateTransitions,
    createDayNightBar,
    createLayoverBar
};
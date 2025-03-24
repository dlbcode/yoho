import { flightMap } from '../flightMap.js';

/**
 * Calculate flight duration from flight data
 * @param {Object} flightData - Flight segment data
 * @param {boolean} returnFormattedString - Whether to return formatted string (default) or duration object
 * @returns {string|Object} - Duration as "Xh Ym" or {hours, minutes} object
 */
export function calculateFlightDuration(flightData, returnFormattedString = true) {
    // Extract duration in hours and minutes
    let durationHours = 0;
    let durationMinutes = 0;
    
    // First priority: segment.duration.flight (most accurate for actual flight time)
    if (flightData.duration && typeof flightData.duration.flight === 'number') {
        durationHours = Math.floor(flightData.duration.flight / 3600);
        durationMinutes = Math.floor((flightData.duration.flight % 3600) / 60);
    } 
    // Second priority: segment.duration total (if available as a number)
    else if (flightData.duration && typeof flightData.duration === 'number') {
        durationHours = Math.floor(flightData.duration / 3600);
        durationMinutes = Math.floor((flightData.duration % 3600) / 60);
    }
    // Third priority: Parse the fly_duration string
    else if (flightData.fly_duration) {
        const durMatch = flightData.fly_duration.match(/(\d+)h\s*(?:(\d+)m)?/);
        if (durMatch) {
            durationHours = parseInt(durMatch[1]) || 0;
            durationMinutes = parseInt(durMatch[2]) || 0;
        } 
    }
    // Fourth priority: Look for a flying_time property (some APIs provide this)
    else if (flightData.flying_time) {
        durationHours = Math.floor(flightData.flying_time / 3600);
        durationMinutes = Math.floor((flightData.flying_time % 3600) / 60);
    }
    // Last resort: Calculate from timestamps with timezone considerations
    else {
        const departureDate = flightData.local_departure ? 
            new Date(flightData.local_departure) : 
            new Date(flightData.dTime * 1000);
            
        const arrivalDate = flightData.local_arrival ? 
            new Date(flightData.local_arrival) : 
            new Date(flightData.aTime * 1000);
        
        // Get origin and destination airports for geographic check
        const origin = flightMap.airportDataCache[flightData.flyFrom];
        const destination = flightMap.airportDataCache[flightData.flyTo];
        
        // Handle potential IDL crossing
        let timeDiff = (arrivalDate - departureDate) / (60 * 60 * 1000);
        
        // Check if this might be an International Date Line crossing
        if (origin && destination) {
            const crossesIDL = 
                (origin.longitude < 0 && destination.longitude > 150) || 
                (origin.longitude > 150 && destination.longitude < 0);
                
            // If crossing IDL and time difference seems suspiciously short, adjust
            if (crossesIDL && timeDiff < 0) {
                timeDiff += 24;
            } else if (crossesIDL && timeDiff > 20) {
                timeDiff -= 24;
            }
        }
        
        // Check for reasonable flight times - if calculated time seems too long,
        // it's likely because of timezone differences
        if (timeDiff > 20 || timeDiff < 0) {
            // Get the great circle distance between airports and estimate flight time
            if (origin && destination) {
                // Calculate approximate flight time based on distance
                // Typical commercial aircraft: ~500 mph = ~800 km/h
                const lat1 = origin.latitude * Math.PI / 180;
                const lon1 = origin.longitude * Math.PI / 180;
                const lat2 = destination.latitude * Math.PI / 180;
                const lon2 = destination.longitude * Math.PI / 180;
                
                // Haversine formula for distance
                const R = 6371; // Earth's radius in km
                const dLat = lat2 - lat1;
                const dLon = lon2 - lon1;
                const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                          Math.cos(lat1) * Math.cos(lat2) *
                          Math.sin(dLon/2) * Math.sin(dLon/2);
                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                const distance = R * c; // Distance in km
                
                // Estimate flight time: distance/speed + 0.5h for takeoff/landing
                timeDiff = distance / 800 + 0.5;
            } else {
                // If geographic data is unavailable, use a reasonable default
                timeDiff = Math.min(Math.abs(timeDiff) % 24, 5);
            }
        }
        
        // Ensure we have reasonable duration values (not too long for a single segment)
        timeDiff = Math.max(0, Math.min(timeDiff, 20));
        
        durationHours = Math.floor(timeDiff);
        durationMinutes = Math.floor((timeDiff - durationHours) * 60);
    }
    
    // Return formatted string or duration object based on parameter
    if (returnFormattedString) {
        return `${durationHours}h ${durationMinutes}m`;
    } else {
        return { hours: durationHours, minutes: durationMinutes };
    }
}

/**
 * Calculate duration in hours from a duration object or hours/minutes
 * @param {Object|number} hours - Duration object or hours value
 * @param {number} minutes - Minutes value if hours is a number
 * @returns {number} - Duration in decimal hours
 */
export function calculateDurationHours(hours, minutes = 0) {
    if (typeof hours === 'object' && hours !== null) {
        return hours.hours + (hours.minutes / 60);
    }
    return hours + (minutes / 60);
}
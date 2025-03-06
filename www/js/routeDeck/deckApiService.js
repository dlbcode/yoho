/**
 * Builds the API URL based on origin, destination and dates
 * @param {string} origin - Origin airport IATA code or 'Any'
 * @param {string} destination - Destination airport IATA code or 'Any'
 * @param {string} departDate - Departure date or date range
 * @param {string} returnDate - Return date or empty string
 * @returns {Object} Object containing URL and endpoint type
 */
function buildApiUrl(origin, destination, departDate, returnDate) {
    let endpoint, url;

    // Handle 'Any' origin case - use cheapestFlightsTo endpoint
    if (origin === 'Any') {
        endpoint = 'cheapestFlightsTo';
        url = `https://yonderhop.com/api/${endpoint}?destination=${destination}`;
        
        if (departDate !== 'any') {
            const [dateFrom, dateTo] = departDate.includes(' to ') 
                ? departDate.split(' to ') 
                : [departDate, departDate];
            url += `&date_from=${dateFrom}&date_to=${dateTo}`;
        }
        
        // Add default price limit and radius parameters
        url += '&price_to=500&radius=2000';
    }
    // Handle 'Any' destination case - use existing cheapestFlights endpoint
    else if (destination === 'Any') {
        endpoint = 'cheapestFlights';
        url = `https://yonderhop.com/api/${endpoint}?origin=${origin}`;
        
        if (departDate !== 'any') {
            const [dateFrom, dateTo] = departDate.includes(' to ') 
                ? departDate.split(' to ') 
                : [departDate, departDate];
            url += `&date_from=${dateFrom}&date_to=${dateTo}`;
        }
    }
    // Handle normal case with specific origin and destination
    else {
        if (departDate === 'any' || returnDate === 'any') {
            endpoint = 'range';
            url = `https://yonderhop.com/api/${endpoint}?flyFrom=${origin}&flyTo=${destination}`;
        } else if (departDate.includes(' to ') || returnDate.includes(' to ')) {
            endpoint = 'range';
            const [dateFrom, dateTo] = departDate.includes(' to ') 
                ? departDate.split(' to ') 
                : [departDate, returnDate];
            url = `https://yonderhop.com/api/${endpoint}?flyFrom=${origin}&flyTo=${destination}&dateFrom=${dateFrom}&dateTo=${dateTo}`;
        } else {
            endpoint = returnDate ? 'yhreturn' : 'yhoneway';
            url = `https://yonderhop.com/api/${endpoint}?origin=${origin}&destination=${destination}&departureDate=${departDate}`;
            if (returnDate) url += `&returnDate=${returnDate}`;
        }
    }

    return { url, endpoint };
}

export { buildApiUrl };

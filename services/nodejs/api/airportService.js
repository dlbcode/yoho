const axios = require('axios');

// Shared function to fetch airport data from Tequila API and upsert into MongoDB
async function fetchAndUpsertAirport(iata, airportsCollection) {
    const TEQUILA_API_KEY = process.env.TEQUILA_API_KEY;
    const url = `https://tequila-api.kiwi.com/locations/query?term=${iata}&location_types=airport`;

    try {
        const response = await axios.get(url, {
            headers: {
                'apikey': TEQUILA_API_KEY,
            },
        });

        if (response.data && response.data.locations && response.data.locations.length > 0) {
            const location = response.data.locations[0];
            const airportData = {
                iata_code: location.code,
                city: location.city ? location.city.name : 'Unknown City',
                country: location.city && location.city.country ? location.city.country.name : 'Unknown Country',
                latitude: parseFloat(location.location.lat),
                longitude: parseFloat(location.location.lon),
                name: location.name,
                type: location.type,
                weight: location.rank, // Invert rank to match weight system
                source: 'tequila'
            };

            // Upsert into MongoDB
            await airportsCollection.updateOne({ iata_code: location.code }, { $set: airportData }, { upsert: true });
            return airportData;
        }
    } catch (error) {
        console.error('Error fetching airport data from Tequila API:', error);
        return null;
    }
}

module.exports = { fetchAndUpsertAirport };

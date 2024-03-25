const axios = require('axios');

function calculateWeight(rank) {
    if (rank >= 1 && rank <= 99) return 1;
    if (rank >= 100 && rank <= 199) return 2;
    if (rank >= 200 && rank <= 399) return 3;
    if (rank >= 400 && rank <= 599) return 4;
    if (rank >= 600 && rank <= 899) return 5;
    if (rank >= 900 && rank <= 1099) return 6;
    if (rank >= 1100 && rank <= 1299) return 7;
    if (rank >= 1300 && rank <= 1499) return 8;
    if (rank >= 1500 && rank <= 1999) return 9;
    return 10; // For rank 2000 and above
}

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
                weight: calculateWeight(location.rank),
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

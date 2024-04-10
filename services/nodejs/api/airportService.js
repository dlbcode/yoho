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
    const url = `https://tequila-api.kiwi.com/locations/query?term=${iata}&location_types=airport&location_types=city&location_types=country&location_types=region&location_types=continent`;

    try {
        const response = await axios.get(url, {
            headers: {
                'apikey': TEQUILA_API_KEY,
            },
        });

        if (response.data && response.data.locations && response.data.locations.length > 0) {
            // Try to find an exact match for airport, then for other types
            console.log('trying to find exact match for iata: ', iata + ' in response: ', response.data.locations);
            let exactMatch = response.data.locations.find(location => location.type === 'airport' && location.code && location.code.toUpperCase() === iata.toUpperCase());

            if (!exactMatch) {
                const locationTypes = ['city', 'country', 'region', 'continent'];
                for (let type of locationTypes) {
                    console.log('trying to find match for iata: ', iata +' in type: ', type);
                    exactMatch = response.data.locations.find(location => location.type === type && location.code && location.code.toUpperCase() === iata.toUpperCase());
                    if (exactMatch) break; // Stop if an exact match is found
                }
            }

            // Ensure exactMatch and necessary properties are not null before proceeding
            if (exactMatch && exactMatch.code) {
                let city = 'Unknown City', country = 'Unknown Country';
            
                // Handling based on the type of exactMatch
                switch (exactMatch.type) {
                    case 'city':
                        city = exactMatch.name;
                        country = exactMatch.country ? exactMatch.country.name : 'Unknown Country';
                        break;
                    case 'country':
                        city = 'Any'; // Not applicable for countries
                        country = exactMatch.name;
                        break;
                    case 'airport':
                        // For airports, check if city information is available and map accordingly
                        if (exactMatch.city && exactMatch.city.name) {
                            city = exactMatch.city.name;
                            // Check if country information is available under the city
                            if (exactMatch.city.country && exactMatch.city.country.name) {
                                country = exactMatch.city.country.name;
                            }
                        }
                        break;
                    // Add cases for 'region' and 'continent' if necessary
                }
            
                const airportData = {
                    iata_code: exactMatch.code,
                    city: city,
                    country: country,
                    latitude: exactMatch.location ? parseFloat(exactMatch.location.lat) : null,
                    longitude: exactMatch.location ? parseFloat(exactMatch.location.lon) : null,
                    name: exactMatch.name,
                    type: exactMatch.type,
                    weight: calculateWeight(exactMatch.rank),
                    source: 'tequila'
                };
            
                await airportsCollection.updateOne({ iata_code: exactMatch.code }, { $set: airportData }, { upsert: true });
                return [airportData]; // Return the upserted data as an array for consistency
            }            
            
        }
    } catch (error) {
        console.error('Error fetching airport data from Tequila API:', error);
        return null;
    }
}

module.exports = { fetchAndUpsertAirport };
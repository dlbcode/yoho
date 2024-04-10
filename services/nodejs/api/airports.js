const { fetchAndUpsertAirport } = require('./airportService');

module.exports = function(app, airportsCollection) {
  app.get('/airports', async (req, res) => {
    try {
      const queryParam = req.query.iata || req.query.query;

      if (!queryParam) {
        const airports = await airportsCollection.find({}).toArray();
        return res.json(airports);
      }

      // Initially fetch all potential matches based on iata_code and name fields
      const searchRegex = new RegExp(queryParam, 'i');
      let airports = await airportsCollection.find({
        $or: [
          { iata_code: searchRegex },
          { name: searchRegex },
          { city: searchRegex }, // Include city in the initial search
          { country: searchRegex } // Include country in the initial search
        ]
      }).toArray();

      // Apply sorting logic
      if (airports.length > 0) {
        airports = sortAirports(airports, queryParam);
        return res.json(airports);
      } else {
        // If no matches found locally, try the external API
        const newAirports = await fetchAndUpsertAirport(queryParam, airportsCollection);
        if (newAirports && newAirports.length > 0) {
          return res.json(sortAirports(newAirports, queryParam)); // Apply sorting to new airports as well
        } else {
          return res.status(404).send('No airports found');
        }
      }
    } catch (error) {
      console.error('Error fetching airports data:', error);
      res.status(500).json({ error: 'Error fetching airports data' });
    }
  });
};

function sortAirports(airports, query) {
  return airports.sort((a, b) => {
    const aMatchScore = getMatchScore(a, query);
    const bMatchScore = getMatchScore(b, query);

    return aMatchScore - bMatchScore;
  });
}

function getMatchScore(airport, query) {
  // Exact iata_code match
  if (airport.iata_code.toUpperCase() === query.toUpperCase()) return 1;
  // iata_code partially matches and is an airport
  if (airport.iata_code.toUpperCase().includes(query.toUpperCase()) && airport.type === 'airport') return 4;
  // Partial matches on city, country, or name fields
  if (airport.city.toUpperCase().includes(query.toUpperCase())) return 5;
  if (airport.country.toUpperCase().includes(query.toUpperCase())) return 6;
  if (airport.name.toUpperCase().includes(query.toUpperCase())) return 7;
  
  return 8; // Fallback score
}

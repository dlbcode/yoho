const { fetchAndUpsertAirport } = require('./airportService');

module.exports = function(app, airportsCollection) {
  app.get('/airports', async (req, res) => {
    try {
      const iataParam = req.query.iata;
      const queryParam = req.query.query;
      
      // Check if no query parameters are provided and return all airports
      if (!iataParam && !queryParam) {
        const airports = await airportsCollection.find({}).toArray();
        return res.json(airports);
      }

      const searchParam = iataParam || queryParam;
      const searchRegex = new RegExp(searchParam, 'i');
      const airports = await airportsCollection.find({
        $or: [
          { iata_code: searchRegex },
          { name: searchRegex }
        ]
      }).toArray();

      if (airports.length > 0) {
        // Sort the results only if there are query parameters
        const sortedAirports = sortAirports(airports, searchParam);
        res.json(sortedAirports);
      } else {
        // If no matches found locally, try the external API
        const newAirports = await fetchAndUpsertAirport(searchParam, airportsCollection);
        if (newAirports && newAirports.length > 0) {
          res.json(newAirports);
        } else {
          res.status(404).send('No airports found');
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
  if (airport.iata_code.toUpperCase() === query.toUpperCase()) {
    return (airport.type === 'airport') ? 1 : (airport.type === 'city') ? 2 : 3;
  } else if (airport.iata_code.toUpperCase().startsWith(query.toUpperCase())) {
    return (airport.type === 'airport') ? 4 : (airport.type === 'city') ? 5 : 6;
  } else if (airport.name.toUpperCase().includes(query.toUpperCase())) {
    return 7;
  }
  return 8; // Default case
}

const { fetchAndUpsertAirport } = require('./airportService');

module.exports = function(app, airportsCollection) {
  app.get('/airports', async (req, res) => {
    try {
      let query = {};
      const iataParam = req.query.iata;
      const queryParam = req.query.query;

      // Construct query based on iataParam or queryParam
      if (iataParam) {
        query = { iata_code: iataParam.toUpperCase() };
      } else if (queryParam) {
        // Use regex for partial matching
        const regex = new RegExp(queryParam, 'i'); // Removed "^" to allow partial matches anywhere in the string
        query = { $or: [{ iata_code: regex }, { name: regex }, { city: regex }, { country: regex }] };
      }

      // Fetch potential matches from the local collection
      const airports = await airportsCollection.find(query).toArray();

      // Updated logic for determining exactMatch
      let exactMatch = false;
      if (iataParam || queryParam) {
          const searchParam = (iataParam || queryParam).toUpperCase();
          exactMatch = airports.some(airport => airport.iata_code === searchParam);
      }

      console.log('exactMatch: ', exactMatch, ' for iataParam: ', iataParam, ' and queryParam: ', queryParam, ' airports: ', airports.length);

      if (!exactMatch && queryParam) {
          // If no exact match is found and there's a query, try the external API
          console.log('No exact matching iata_code found, searching using Tequila API for: ', queryParam || iataParam);
          const newAirports = await fetchAndUpsertAirport(queryParam || iataParam, airportsCollection);
          if (newAirports && newAirports.length > 0) {
              res.json(newAirports); // Return the newly added airports
          } else if (airports.length > 0) {
              // Return local non-exact matches if no new airports are added
              res.json(airports);
          } else {
              res.status(404).send('No airports found');
          }
      } else {
          // Return the airports from the collection, both exact and non-exact matches
          res.json(airports);
      }
    } catch (error) {
      console.error('Error fetching airports data:', error);
      res.status(500).json({ error: 'Error fetching airports data' });
    }
  });
};

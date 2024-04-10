const { fetchAndUpsertAirport } = require('./airportService');

module.exports = function(app, airportsCollection) {
  app.get('/airports', async (req, res) => {
    try {
      let query = {};

      const iataParam = req.query.iata;
      const queryParam = req.query.query;

      if (iataParam) {
        query = { iata_code: iataParam.toUpperCase() };
      } else if (queryParam && queryParam.length >= 3) { // Ensure at least 3 characters in query
        const regex = new RegExp("^" + queryParam, 'i');
        query = { $or: [{ iata_code: regex }, { name: regex }, { city: regex }, { country: regex }] };
      }

      const airports = await airportsCollection.find(query).limit(iataParam || queryParam ? 7 : 0).toArray();

      // Check if any returned airport exactly matches the iataParam or queryParam
      let exactMatch = false;
      if (iataParam || queryParam) {
        const searchParam = (iataParam || queryParam).toUpperCase();
        exactMatch = airports.some(airport => airport.iata_code === searchParam);
      }

      if (!exactMatch && queryParam && queryParam.length >= 3) {
        // No exact matching iata_code found, search using Tequila API
        const newAirports = await fetchAndUpsertAirport(queryParam, airportsCollection);
        if (newAirports && newAirports.length > 0) {
          res.json(newAirports); // Return the newly added airports
        } else {
          res.status(404).send('No airports found');
        }
      } else {
        res.json(airports); // Return the airports from the collection
      }
    } catch (error) {
      console.error('Error fetching airports data:', error);
      res.status(500).json({ error: 'Error fetching airports data' });
    }
  });
};

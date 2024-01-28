module.exports = function(app, amadeus, flightsCollection) {
  app.get('/atcd', async (req, res) => {
  try {
      const { origin, destination } = req.query;

      if (!origin || !destination) {
          return res.status(400).send('Origin and destination IATA codes are required');
      }

      const response = await amadeus.shopping.flightDates.get({
        origin: origin,
        destination: destination
      });

      // Process the flight data
      const flightsData = response.data.map(flight => {
          return {
              origin: origin,
              destination: destination,
              departureDate: flight.departureDate,
              returnDate: flight.returnDate,
              price: flight.price.total,
              timestamp: new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 12),
              source: "atcd"
          };
      });

      // Remove existing flights with the same origin and destination
      await flightsCollection.deleteMany({
          origin: origin,
          dest: destination
      });

      // Insert the new flights
      await flightsCollection.insertMany(flightsData);

      res.json(flightsData);
  } catch (error) {
      console.error('Error fetching cheapest date/flight information:', error);
      res.status(500).send(`Error fetching cheapest date/flight information: ${error.message}`);
  }
});
};
module.exports = function(app, airportsCollection, routesCollection) {
app.get('/directRoutes', async (req, res) => {
  try {
      const { origin, direction } = req.query;
      let query = {};

      if (!origin) {
          return res.status(400).send('Origin IATA code is required');
      }

      if (direction) {
          const filterDirection = direction.toLowerCase();
          if (filterDirection === 'to') {
              query.destination = origin.toUpperCase();
          } else if (filterDirection === 'from') {
              query.origin = origin.toUpperCase();
          } else {
              return res.status(400).send('Invalid direction');
          }
      } else {
          return res.status(400).send('Direction is required');
      }

      const directRoutes = await routesCollection.find(query).toArray();

      const airports = await airportsCollection.find({}).toArray();
      const airportMap = airports.reduce((map, airport) => {
          map[airport.iata_code] = airport;
          return map;
      }, {});

      const enrichedRoutes = directRoutes.map(route => {
          return {
              ...route,
              originAirport: airportMap[route.origin],
              destinationAirport: airportMap[route.destination]
          };
      });

      res.status(200).json(enrichedRoutes);
  } catch (e) {
      console.error(e);
      res.status(500).send("Error fetching routes data");
  }
});
}
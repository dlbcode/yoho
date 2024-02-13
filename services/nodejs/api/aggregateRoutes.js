module.exports = function(app, airportsCollection, routesCollection) {
  app.get('/aggregateRoutes', async (req, res) => {
      try {
          // Fetch all airports and create a map for quick lookup
          const airports = await airportsCollection.find({}).toArray();
          const airportMap = airports.reduce((map, airport) => {
              map[airport.iata_code] = {
                  iata_code: airport.iata_code,
                  latitude: airport.latitude,
                  longitude: airport.longitude
              };
              return map;
          }, {});

          // Fetch all routes
          const routes = await routesCollection.find({}).toArray();

          // Enrich routes with the necessary airport details
          const enrichedRoutes = routes.map(route => ({
              origin_iata_code: route.origin,
              destination_iata_code: route.destination,
              price: route.price,
              origin: airportMap[route.origin],
              destination: airportMap[route.destination]
          }));

          // Respond with the enriched routes
          res.status(200).json(enrichedRoutes);
      } catch (error) {
          console.error('Failed to fetch aggregate routes:', error);
          res.status(500).send('Internal Server Error');
      }
  });
};

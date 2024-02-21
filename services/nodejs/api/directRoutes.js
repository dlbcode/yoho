const { fetchAndUpsertAirport } = require('./airportService');

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

            // Fetch and enrich airport data
            const enrichedRoutes = await Promise.all(directRoutes.map(async (route) => {
                let originAirport = await airportsCollection.findOne({ iata_code: route.origin });
                let destinationAirport = await airportsCollection.findOne({ iata_code: route.destination });

                // Use fetchAndUpsertAirport from airportService if not found
                if (!originAirport) {
                    originAirport = await fetchAndUpsertAirport(route.origin, airportsCollection);
                }
                if (!destinationAirport) {
                    destinationAirport = await fetchAndUpsertAirport(route.destination, airportsCollection);
                }

                return {
                    ...route,
                    originAirport,
                    destinationAirport
                };
            }));

            res.status(200).json(enrichedRoutes);
        } catch (e) {
            console.error(e);
            res.status(500).send("Error fetching routes data");
        }
    });
};

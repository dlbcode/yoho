const axios = require('axios');

module.exports = function(app, db, tequilaConfig) {
    app.get('/range', async (req, res) => {
        const { flyFrom, flyTo, dateFrom, dateTo } = req.query;

        if (!flyFrom || !flyTo || !dateFrom || !dateTo) {
            return res.status(400).send('Missing required parameters.');
        }

        const cacheCollection = db.collection('cache');
        const routeKey = `${flyFrom}-${flyTo}`; // Key based on origin-destination

        // Attempt to fetch recent cached flights for the route
        try {
            const recentCachedFlights = await cacheCollection.find({
                flight: routeKey,
                queriedAt: { $gte: new Date(new Date().getTime() - 24*60*60*1000) } // Flights cached within the last 24 hours
            }).toArray();

            if (recentCachedFlights && recentCachedFlights.length > 0) {
                // Return cached flights if they exist and are recent
                return res.json(recentCachedFlights.map(flight => flight.data));
            }
        } catch (error) {
            console.error("Error accessing cache:", error);
        }

        // Fetch fresh results from the API if no recent cached flights are found
        try {
            const response = await axios.get(tequilaConfig.url, {
                headers: tequilaConfig.headers,
                params: {
                    fly_from: flyFrom,
                    fly_to: flyTo,
                    date_from: dateFrom,
                    date_to: dateTo,
                    one_per_date: 1, // To get the cheapest flight for each date
                    partner: 'picky',
                    curr: 'USD'
                }
            });

            if (response.data && response.data.data) {
                const flightsData = response.data.data;

                // Cache each flight individually
                for (const flight of flightsData) {
                    await cacheCollection.insertOne({
                        flight: routeKey,
                        data: flight,
                        source: 'tequila',
                        queriedAt: new Date()
                    });
                }

                // Return the fresh flights data
                res.json(flightsData);
            } else {
                res.status(500).send("No flight data found");
            }
        } catch (error) {
            console.error('Tequila API request failed:', error);
            res.status(500).send('Failed to fetch data from Tequila API.');
        }
    });
};

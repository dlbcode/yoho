const axios = require('axios');
const updateDirectRoutes = require('./directRouteHandler'); // Import the updateDirectRoutes function

module.exports = function(app, db, tequilaConfig) {
    app.get('/range', async (req, res) => {
        const { flyFrom, flyTo, dateFrom, dateTo } = req.query;

        if (!flyFrom || !flyTo) {
            return res.status(400).send('Missing required parameters.');
        }

        const flightKey = `${flyFrom}-${flyTo}-${dateFrom || 'any'}-${dateTo || 'any'}`;
        const cacheCollection = db.collection('cache');
        let flightsData = null;

        try {
            const cachedData = await cacheCollection.findOne({ flight: flightKey });
            if (cachedData && cachedData.queriedAt) {
                const hoursDiff = (new Date() - cachedData.queriedAt) / (1000 * 60 * 60);
                if (hoursDiff <= 24) {
                    flightsData = cachedData;
                    res.json(flightsData);
                    return;
                }
            }
        } catch (error) {
            console.error("Error accessing cache:", error);
        }

        try {
            const params = {
                fly_from: flyFrom,
                fly_to: flyTo,
                one_per_date: 1, // To get the cheapest flight for each date
                partner: 'picky',
                curr: 'USD'
            };

            if (dateFrom && dateTo) {
                params.date_from = dateFrom;
                params.date_to = dateTo;
            }

            const response = await axios.get(tequilaConfig.url, {
                headers: tequilaConfig.headers,
                params
            });

            if (response.data && response.data.data) {
                flightsData = response.data.data.sort((a, b) => a.price - b.price);
                await cacheCollection.updateOne(
                    { flight: flightKey },
                    { $set: { data: flightsData, queriedAt: new Date() } },
                    { upsert: true }
                );
                res.json(response.data);
                processDirectRoutes(flightsData); // Additional handling for direct routes
            } else {
                res.status(500).send("No flight data found");
            }
        } catch (error) {
            console.error('Tequila API request failed:', error);
            res.status(500).send('Failed to fetch data from Tequila API.');
        }
    });

    async function processDirectRoutes(flightsData) {
        const directFlights = flightsData.filter(flight => flight.route && flight.route.length === 1);
        if (directFlights.length > 0) {
            const lowestPricedDirectFlight = directFlights.reduce((lowest, flight) => flight.price < lowest.price ? flight : lowest, directFlights[0]);
            const flightData = {
                origin: lowestPricedDirectFlight.route[0].flyFrom,
                destination: lowestPricedDirectFlight.route[0].flyTo,
                price: lowestPricedDirectFlight.price,
                departureDate: new Date(lowestPricedDirectFlight.dTime * 1000).toISOString()
            };
            await updateDirectRoutes(db, [flightData]);
        }
    }
};

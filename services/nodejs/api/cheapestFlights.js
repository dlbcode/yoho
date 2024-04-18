const axios = require('axios');
const updateDirectRoutes = require('./directRouteHandler'); // Import the updateDirectRoutes function

module.exports = function(app, db, tequila) {
    app.get('/cheapestFlights', async (req, res) => {
        const flightsCollection = db.collection('flights');

        const { origin, date_from: dateFrom, date_to: dateTo, price_to: priceTo = 500, limit = 100 } = req.query;

        if (!origin || !dateFrom || !dateTo) {
            return res.status(400).send('Origin and date range are required');
        }

        const cacheKey = {
            origin: origin,
            destination: 'Any', // Using 'Any' as a placeholder for generic destination
            fromDate: new Date(dateFrom).getTime(),
            toDate: new Date(dateTo).getTime()
        };

        try {
            const cachedData = await flightsCollection.findOne(cacheKey);

            if (cachedData && (new Date().getTime() - cachedData.timestamp.getTime()) < 24 * 60 * 60 * 1000) {
                res.json(cachedData.results);
            } else {
                const apiUrl = `${tequila.url}?fly_from=${origin}&date_from=${dateFrom}&date_to=${dateTo}&price_to=${priceTo}&one_for_city=1&limit=${limit}&partner=picky&curr=USD`;

                const response = await axios({ ...tequila, url: apiUrl });
                if (response.data && response.data.data) {
                    const sortedFlights = response.data.data.sort((a, b) => a.price - b.price);
                    processDirectRoutes(sortedFlights); // Process direct routes separately
                    const newCacheEntry = {
                        ...cacheKey,
                        timestamp: new Date(),
                        results: response.data
                    };

                    await flightsCollection.updateOne(
                        cacheKey,
                        { $set: newCacheEntry },
                        { upsert: true }
                    );

                    res.json(response.data);
                } else {
                    res.status(500).send("No flight data found");
                }
            }
        } catch (error) {
            console.error("Error fetching data from Tequila API or interacting with MongoDB:", error);
            res.status(500).send('Error fetching data');
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
                departureDate: new Date(lowestPricedDirectFlight.dTime * 1000).toISOString() // Proper conversion of UNIX timestamp
            };
            await updateDirectRoutes(db, [flightData]);
        }
    }
};

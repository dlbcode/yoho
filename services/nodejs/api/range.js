const axios = require('axios');

module.exports = function(app, db, tequilaConfig) {
    app.get('/range', async (req, res) => {
        const { flyFrom, flyTo, dateFrom, dateTo } = req.query;

        if (!flyFrom || !flyTo || !dateFrom || !dateTo) {
            return res.status(400).send('Missing required parameters.');
        }

        // Fetch fresh results from the Tequila API
        try {
            const response = await axios.get(tequilaConfig.url, {
                headers: tequilaConfig.headers,
                params: {
                    fly_from: flyFrom,
                    fly_to: flyTo,
                    date_from: dateFrom,
                    date_to: dateTo,
                    partner: 'picky',
                    curr: 'USD'
                }
            });

            if (response.data && response.data.data) {
                const flightsData = response.data.data;

                // Find the direct route with the lowest price
                const directFlights = flightsData.filter(flight => flight.route.length === 1);
                const lowestPriceDirectFlight = directFlights.reduce((lowest, flight) => {
                    return !lowest || flight.price < lowest.price ? flight : lowest;
                }, null);

                if (lowestPriceDirectFlight) {
                    const directRoutesCollection = db.collection('directRoutes');

                    // Check for a matching route in the directRoutes collection
                    const matchingDirectRoute = await directRoutesCollection.findOne({
                        origin: flyFrom,
                        destination: flyTo
                    });

                    if (matchingDirectRoute && matchingDirectRoute.price > lowestPriceDirectFlight.price) {
                        // Update the price for the matching directRoute document
                        await directRoutesCollection.updateOne(
                            { _id: matchingDirectRoute._id },
                            { $set: { price: lowestPriceDirectFlight.price, source: 'tequila', timestamp: new Date().toISOString() } }
                        );
                    }
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

const axios = require('axios');

module.exports = function(app, db, tequilaConfig) {
    app.get('/range', async (req, res) => {
        const { flyFrom, flyTo, dateFrom, dateTo } = req.query;

        if (!flyFrom || !flyTo || !dateFrom || !dateTo) {
            return res.status(400).send('Missing required parameters.');
        }

        // Define the cache key
        const flightKey = `${flyFrom}-${flyTo}`;
        const cacheCollection = db.collection('cache');

        // Check for cached data
        try {
            const cachedData = await cacheCollection.findOne({ flight: flightKey });
            if (cachedData && cachedData.queriedAt) {
                const hoursDiff = (new Date() - new Date(cachedData.queriedAt)) / (1000 * 60 * 60);
                if (hoursDiff <= 24) {
                    // Cached data is fresh, return it
                    return res.json(cachedData.data);
                }
            }
        } catch (error) {
            console.error("Error accessing cache:", error);
        }

        // Make external API call if no fresh cached data is found
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

            // Assuming the flights are in response.data.data
            if (response.data && response.data.data) {
                // Update cache with new data
                await cacheCollection.updateOne(
                    { flight: flightKey },
                    { $set: { data: response.data.data, source: 'tequila', queriedAt: new Date() } },
                    { upsert: true }
                );

                // Return the new data
                res.json(response.data.data);
            } else {
                res.status(500).send("No flight data found");
            }
        } catch (error) {
            console.error('Tequila API request failed:', error);
            res.status(500).send('Failed to fetch data from Tequila API.');
        }
    });
};

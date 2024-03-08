const axios = require('axios');

module.exports = function(app, db, tequilaConfig) {
    app.get('/range', async (req, res) => {
        const { flyFrom, flyTo, dateFrom, dateTo } = req.query;

        if (!flyFrom || !flyTo || !dateFrom || !dateTo) {
            return res.status(400).send('Missing required parameters.');
        }

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
                const sortedFlights = response.data.data.sort((a, b) => a.price - b.price);
                res.json(sortedFlights); // Send sorted flights array directly
            } else {
                res.status(500).send("No flight data found");
            }
        } catch (error) {
            console.error('Tequila API request failed:', error);
            res.status(500).send('Failed to fetch data from Tequila API.');
        }
    });
};

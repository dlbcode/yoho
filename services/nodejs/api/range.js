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

            res.json(response.data);
        } catch (error) {
            console.error('Tequila API request failed:', error);
            res.status(500).send('Failed to fetch data from Tequila API.');
        }
    });
};

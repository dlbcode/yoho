const axios = require('axios');
const updateDirectRoutes = require('./directRouteHandler'); // Import the updateDirectRoutes function

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

            if (response.data && response.data.data) {
                const flightsData = response.data.data.sort((a, b) => a.price - b.price);
                processDirectRoutes(flightsData); // Process direct routes without affecting the response
                res.json(response.data); // Send the full sorted flight data back to the client
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

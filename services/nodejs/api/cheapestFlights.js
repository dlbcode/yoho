const axios = require('axios');
const updateDirectRoutes = require('./directRouteHandler'); // Import the updateDirectRoutes function

module.exports = function(app, db, tequila) {
  app.get('/cheapestFlights', async (req, res) => {
    const flightsCollection = db.collection('flights');

    const { origin, date_from: dateFrom, date_to: dateTo, price_to: priceTo = 500, limit = 100 } = req.query;

    if (!origin || !dateFrom || !dateTo) {
      return res.status(400).send('Origin and date range are required');
    }

    const fromDate = new Date(dateFrom).getTime();
    const toDate = new Date(dateTo).getTime();

    try {
      const cachedData = await flightsCollection.findOne({
        origin: origin,
        fromDate: { $lte: fromDate },
        toDate: { $gte: toDate }
      });

      const now = new Date().getTime();
      if (cachedData && (now - cachedData.timestamp.getTime()) < 24 * 60 * 60 * 1000) {
        return res.json(cachedData.results);
      } else {
        // Adjust the URL and query parameters based on the request
        const apiUrl = `${tequila.url}?fly_from=${origin}&date_from=${dateFrom}&date_to=${dateTo}&price_to=${priceTo}&one_for_city=1&limit=${limit}`;

        const response = await axios({ ...tequila, url: apiUrl });
        const flightsData = response.data.flights || [];
        const sortedFlights = flightsData.sort((a, b) => a.price - b.price);

        await updateDirectRoutes(db, sortedFlights);

        const newCacheEntry = {
          origin: origin,
          fromDate: fromDate,
          toDate: toDate,
          timestamp: new Date(),
          results: response.data
        };

        await flightsCollection.updateOne(
          { origin: origin, fromDate: fromDate, toDate: toDate },
          { $set: newCacheEntry },
          { upsert: true }
        );

        res.json(response.data);
      }
    } catch (error) {
      console.error("Error fetching data from Tequila API or interacting with MongoDB:", error);
      res.status(500).send('Error fetching data');
    }
  });
};

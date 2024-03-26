const axios = require('axios');

module.exports = function(app, dbClient) {
  app.get('/cheapestFlights', async (req, res) => {
    const flightsCollection = dbClient.collection('flights'); // Adjusted to use dbClient directly

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
        const response = await axios.get(`https://api.tequila.kiwi.com/v2/search?fly_from=${origin}&date_from=${dateFrom}&date_to=${dateTo}&price_to=${priceTo}&one_for_city=1&limit=${limit}`, {
          headers: { 'apikey': process.env.TEQUILA_API_KEY }
        });

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

module.exports = function(app, axios, db) {
  app.get('/yhoneway', async (req, res) => {
    const { origin, destination, departureDate } = req.query;

    if (!origin || !destination || !departureDate) {
      return res.status(400).send('Origin, destination, and date are required');
    }
  
    const flightKey = `${origin}-${destination}`;
    const cacheCollection = db.collection('cache');
    
    try {
      // Convert the requested departureDate to a Date object for comparison
      const requestedDepartureDate = new Date(departureDate).setHours(0, 0, 0, 0);
      
      const cachedData = await cacheCollection.find({ flight: flightKey }).toArray();
      const validCachedData = cachedData.filter(data => {
        // Extract the departure date from either local_departure or dTime
        const cachedDepartureDate = data.data.local_departure ? new Date(data.data.local_departure).setHours(0, 0, 0, 0) : new Date(data.data.dTime * 1000).setHours(0, 0, 0, 0);
        return requestedDepartureDate === cachedDepartureDate;
      });

      if (validCachedData.length > 0 && validCachedData[0].queriedAt) {
        const hoursDiff = (new Date() - validCachedData[0].queriedAt) / (1000 * 60 * 60);
        if (hoursDiff <= 24) {
          return res.json(validCachedData[0].data);
        }
      }
    } catch (error) {
      console.error("Error accessing cache:", error);
    }

    const config = {
      method: 'get',
      url: `https://tequila-api.kiwi.com/v2/search?fly_from=${origin}&fly_to=${destination}&date_from=${departureDate}&date_to=${departureDate}&flight_type=oneway&partner=picky&curr=USD`,
      headers: { 
        'apikey': process.env.TEQUILA_API_KEY
      }
    };

    try {
      const response = await axios(config);
      if (response.data && response.data.data) {
        const sortedFlights = response.data.data.sort((a, b) => a.price - b.price);
        await cacheCollection.updateOne(
          { flight: flightKey },
          { $set: { data: sortedFlights, source: 'tequila', queriedAt: new Date() } },
          { upsert: true }
        );

        res.json(sortedFlights);
      } else {
        res.status(500).send("No flight data found");
      }
    } catch (error) {
      console.error("Error fetching one-way flights data:", error.response ? error.response.data : error.message);
      res.status(500).send("Error fetching one-way flights data");
    }
  });
};

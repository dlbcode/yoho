const updateDirectRoutes = require('./directRouteHandler');

module.exports = function(app, axios, db) {
  app.get('/yhoneway', async (req, res) => {
    const { origin, destination, departureDate } = req.query;

    if (!origin || !destination || !departureDate) {
      return res.status(400).send('Origin, destination, and date are required');
    }

    const flightKey = `${origin}-${destination}-${departureDate}`;
    const cacheCollection = db.collection('cache');
    let flightsData = null;

    try {
      const cachedData = await cacheCollection.findOne({ flight: flightKey });
      if (cachedData && cachedData.queriedAt) {
        const hoursDiff = (new Date() - cachedData.queriedAt) / (1000 * 60 * 60);
        if (hoursDiff <= 24) {
          flightsData = cachedData.data;
          res.json(flightsData); // Serve cached data
        }
      }
    } catch (error) {
      console.error("Error accessing cache:", error);
    }

    if (!flightsData) { // Fetch new data if not found in cache or cache is outdated
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
          flightsData = response.data.data.sort((a, b) => a.price - b.price);
          await cacheCollection.updateOne(
            { flight: flightKey },
            { $set: { data: flightsData, queriedAt: new Date() } },
            { upsert: true }
          );
          res.json(flightsData);
        } else {
          res.status(500).send("No flight data found");
        }
      } catch (error) {
        console.error("Error fetching one-way flights data:", error.response ? error.response.data : error.message);
        res.status(500).send("Error fetching one-way flights data");
      }
    }

    // Find the lowest priced direct route and update if necessary
    if (flightsData) {
      const directFlights = flightsData.filter(flight => flight.route && flight.route.length === 1);
      if (directFlights.length > 0) {
        const lowestPricedDirectFlight = directFlights.reduce((lowest, flight) => flight.price < lowest.price ? flight : lowest, directFlights[0]);
        const flighttData = {
          origin: lowestPricedDirectFlight.route[0].flyFrom,
          destination: lowestPricedDirectFlight.route[0].flyTo,
          price: lowestPricedDirectFlight.price,
          departureDate: lowestPricedDirectFlight.route[0].local_departure
        };
        await updateDirectRoutes(db, [flighttData]); // Adjust this according to how updateDirectRoutes handles data
      }
    }
});

  // Endpoint for searching return flights
  app.get('/yhreturn', async (req, res) => {
    const { origin, destination, departureDate, returnDate } = req.query;
  
    if (!origin || !destination || !departureDate || !returnDate) {
      return res.status(400).send('Origin, destination, departure date, and return date are required');
    }
  
    const flightKey = `RT-${origin}-${destination}-${departureDate}-${returnDate}`;
    const cacheCollection = db.collection('cache');
    
    // Check cache first
    try {
      const cachedData = await cacheCollection.findOne({ flight: flightKey });
      if (cachedData && cachedData.queriedAt) {
        const hoursDiff = (new Date() - cachedData.queriedAt) / (1000 * 60 * 60);
        if (hoursDiff <= 24) {
          // Data is fresh, return cached data
          return res.json(cachedData.data);
        }
        // Data is older than 24 hours, proceed to fetch new data
      }
    } catch (error) {
      console.error("Error accessing cache:", error);
    }
  
    const config = {
      method: 'get',
      url: `https://tequila-api.kiwi.com/v2/search?fly_from=${origin}&fly_to=${destination}&date_from=${departureDate}&date_to=${departureDate}&return_from=${returnDate}&return_to=${returnDate}&partner=picky&curr=USD`,
      headers: { 
        'apikey': process.env.TEQUILA_API_KEY
      }
    };
  
    try {
      const response = await axios(config);
      if (response.data && response.data.data) {
        // Update cache with new data
        console.log(`Updating cache for flight ${flightKey}`);
        await cacheCollection.updateOne(
          { flight: flightKey },
          { $set: { data: response.data.data, queriedAt: new Date() } },
          { upsert: true }
        );
  
        res.json(response.data.data);
      } else {
        res.status(500).send("No flight data found");
      }
    } catch (error) {
      console.error("Error fetching return flights data:", error.response ? error.response.data : error.message);
      res.status(500).send("Error fetching return flights data");
    }
  });  
};

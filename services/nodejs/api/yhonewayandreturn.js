module.exports = function(app, axios, db) {
  app.get('/yhoneway', async (req, res) => {
    const { origin, destination, date } = req.query;

    if (!origin || !destination || !date) {
      return res.status(400).send('Origin, destination, and date are required');
    }

    const flightKey = `${origin}-${destination}`;
    const cacheCollection = db.collection('cache');
    const directRoutesCollection = db.collection('directRoutes');
    
    // Check cache first
    try {
      const cachedData = await cacheCollection.findOne({ flight: flightKey });
      if (cachedData && cachedData.queriedAt) {
        const hoursDiff = (new Date() - new Date(cachedData.queriedAt)) / (1000 * 60 * 60);
        if (hoursDiff <= 24) {
          // Data is fresh, return cached data
          return res.json(cachedData.data);
        }
        // Data is older than 24 hours, proceed to fetch new data
      }
    } catch (error) {
      console.error("Error accessing cache:", error);
    }

    // Proceed with Tequila API request
    const config = {
      method: 'get',
      url: `https://tequila-api.kiwi.com/v2/search?fly_from=${origin}&fly_to=${destination}&date_from=${date}&date_to=${date}&flight_type=oneway&partner=picky&curr=USD`,
      headers: { 
        'apikey': process.env.TEQUILA_API_KEY
      }
    };

    try {
      const response = await axios(config);
      if (response.data && response.data.data) {
        const sortedFlights = response.data.data.sort((a, b) => a.price.total - b.price.total);

        // Update cache with new data
        console.log(`Updating cache for flight ${flightKey}`);
        await cacheCollection.updateOne(
          { flight: flightKey },
          { $set: { data: sortedFlights, queriedAt: new Date() } },
          { upsert: true }
        );

        // Check for direct flights and compare prices with directRoutes collection
        // Inside the try block after fetching data from the Tequila API
        console.log('Checking direct flights');
        const directFlights = sortedFlights.filter(flight => flight.route.length === 1);
        const existingDirectRoute = await directRoutesCollection.findOne({ origin: origin, destination: destination });
        console.log('Existing direct route for origin:', origin, 'and destination:', destination, 'is:', existingDirectRoute.price);
        for (const flight of directFlights) {
          const apiPrice = parseFloat(flight.price.total); // Ensure the price is a number
          console.log('API price for direct flight:', flight.price.total);
          // If there's an existing direct route and the API price is lower, update it.
          // If there's no existing direct route, insert a new one.
          if (!existingDirectRoute || (existingDirectRoute && existingDirectRoute.price > apiPrice)) {
            console.log(`Updating or inserting direct route from ${origin} to ${destination} with price: ${apiPrice}`);
            
            const updateResult = await directRoutesCollection.updateOne(
              { origin: origin, destination: destination },
              { $set: { 
                  origin: origin,
                  destination: destination,
                  price: apiPrice, 
                  timestamp: new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14),
                  source: 'tequila'
                } 
              },
              { upsert: true } // This option creates a new document if no document matches the query
            );
            
            console.log('Update or insert result:', updateResult);
          } else {
            console.log(`No direct route found or API price for direct flight from ${origin} to ${destination} is higher than existing price`);
          }
        }


        res.json(sortedFlights);
      } else {
        res.status(500).send("No flight data found");
      }
    } catch (error) {
      console.error("Error fetching one-way flights data:", error.response ? error.response.data : error.message);
      res.status(500).send("Error fetching one-way flights data");
    }
  });

  // Endpoint for searching return flights
  app.get('/yhreturn', async (req, res) => {
    const { origin, destination, departureDate, returnDate } = req.query;

    if (!origin || !destination || !departureDate || !returnDate) {
      return res.status(400).send('Origin, destination, departure date, and return date are required');
    }

    const config = {
      method: 'get',
      url: `https://tequila-api.kiwi.com/v2/search?fly_from=${origin}&fly_to=${destination}&date_from=${departureDate}&date_to=${returnDate}&flight_type=round&partner=picky`,
      headers: { 
        'apikey': process.env.TEQUILA_API_KEY
      }
    };

    try {
      const response = await axios(config);
      res.json(response.data);
    } catch (error) {
      console.error("Error fetching return flights data:", error.response ? error.response.data : error.message); // More detailed error logging
      res.status(500).send("Error fetching return flights data");
    }
  });
};

const express = require('express');
const MongoClient = require('mongodb').MongoClient;
const app = express();
const port = 3000;
const cors = require('cors');
const mongodbPassword = process.env.MONGO_RSUSER_PASSWORD;

//// Middleware to check the referrer 
//function checkReferrer(req, res, next) {
//    const referrer = req.get('Referrer');
//    if (!referrer || 
//        (!referrer.startsWith('http://44.199.76.209') && 
//         !referrer.startsWith('http://localhost'))) {
//        return res.status(403).send('Access denied');
//    }
//    next();
//}

// use it before all route definitions
app.use(cors({
  origin: ['http://localhost:8002', 'http://44.199.76.209:8002']
}));

//// Apply the referrer check middleware to the API routes
//app.use('/airports', checkReferrer);
//app.use('/flights', checkReferrer);

// MongoDB connection URL and database name
const mongoUrl = `mongodb://rsuser:${mongodbPassword}@mongodb:27017/rsdb`;
const dbName = 'rsdb';

let db;
let airportsCollection;
let flightsCollection;

// Connect to MongoDB
MongoClient.connect(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true }, (err, client) => {
  if (err) throw err;

  db = client.db(dbName);
  airportsCollection = db.collection('airports');
  flightsCollection = db.collection('flights');
  console.log('Connected to MongoDB');
});

app.get('/airports', async (req, res) => {
  try {
    // Check for 'iata' parameter
    const iataParam = req.query.iata;

    let query = {};
    
    if (iataParam) {
      // Find airport by exact IATA code match
      query = { iata_code: iataParam.toUpperCase() }; // Assuming IATA codes are stored in uppercase
    } else {
      // Original logic for 'query' parameter
      const queryParam = req.query.query;
      if (queryParam) {
        const regex = new RegExp("^" + queryParam, 'i'); // Strictly starts with the queryParam
        query = {
          $or: [
            { iata_code: regex },
            { $or: [{ name: regex }, { city: regex }, { country: regex }] }
          ]
        };
      }
    }

    const airports = await airportsCollection.find(query).limit(7).toArray();
    res.json(airports);
  } catch (error) {
    res.status(500).send('Error fetching airports data');
  }
});

// Endpoint to get flights data
app.get('/flights', async (req, res) => {
  try {
      const flights = await flightsCollection.find({}).toArray();
      const airports = await airportsCollection.find({}).toArray();

      const airportMap = airports.reduce((map, airport) => {
          map[airport.iata_code] = airport;
          return map;
      }, {});

      const enrichedFlights = flights.map(flight => {
          return {
              ...flight,
              originAirport: airportMap[flight.origin],
              destinationAirport: airportMap[flight.destination]
          };
      });

      res.status(200).json(enrichedFlights);
  } catch (e) {
      console.error(e);
      res.status(500).send("Error fetching flights data");
  }
});

app.get('/cheapest-routes', async (req, res) => {
  const origin = req.query.origin;
  const destination = req.query.destination;

  if (!origin || !destination) {
      return res.status(400).send('Origin and destination IATA codes are required');
  }

  try {
      const flights = await flightsCollection.find({}).toArray();
      let routes = findCheapestRoutes(flights, origin, destination);
      routes = routes.slice(0, 3); // Get top 3 cheapest routes

      res.json(routes);
  } catch (error) {
      console.error(error);
      res.status(500).send('Error searching for routes');
  }
});

function findCheapestRoutes(flights, origin, destination) {
  let costs = {};
  let paths = {};

  flights.forEach(flight => {
      if (!costs[flight.origin]) {
          costs[flight.origin] = { totalCost: Infinity, segments: [] };
          paths[flight.origin] = [];
      }
      if (!costs[flight.destination]) {
          costs[flight.destination] = { totalCost: Infinity, segments: [] };
          paths[flight.destination] = [];
      }
  });

  costs[origin] = { totalCost: 0, segments: [] };
  paths[origin] = [origin];

  flights.forEach(flight => {
      if (!costs[flight.origin] || !costs[flight.destination]) {
          console.error(`Missing cost or path initialization for flight:`, flight);
      }
  });

  for (let i = 0; i < flights.length; i++) {
      let updated = false;

      flights.forEach(flight => {
          let newCost = costs[flight.origin].totalCost + flight.price;
          if (newCost < costs[flight.destination].totalCost) {
              costs[flight.destination].totalCost = newCost;
              costs[flight.destination].segments = [...costs[flight.origin].segments, { from: flight.origin, to: flight.destination, price: flight.price }];
              paths[flight.destination] = [...paths[flight.origin], flight.destination];
              updated = true;
          }
      });

      if (!updated) break;
  }

  return Object.keys(paths).filter(key => paths[key].includes(destination))
      .map(key => ({
          route: paths[key],
          totalCost: costs[key].totalCost,
          segmentCosts: costs[key].segments
      })).sort((a, b) => a.totalCost - b.totalCost);
}

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

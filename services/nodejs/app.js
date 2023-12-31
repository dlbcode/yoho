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
//         !referrer.startsWith('http://yonderhop.com'))) {
//        return res.status(403).send('Access denied');
//    }
//    next();
//}

// use it before all route definitions
app.use(cors({
  origin: ['http://yonderhop.com:8002',
           'http://localhost:8002'
          ]
}));

//// Apply the referrer check middleware to the API routes
//app.use('/airports', checkReferrer);
//app.use('/routes', checkReferrer);

// MongoDB connection URL and database name
const mongoUrl = `mongodb://rsuser:${mongodbPassword}@mongodb:27017/rsdb`;
const dbName = 'rsdb';

let db;
let airportsCollection;
let routesCollection;

// Connect to MongoDB
MongoClient.connect(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true }, (err, client) => {
  if (err) throw err;

  db = client.db(dbName);
  airportsCollection = db.collection('airports');
  routesCollection = db.collection('routes');
  flightsCollection = db.collection('flights');
  console.log('Connected to MongoDB');
});

app.get('/airports', async (req, res) => {
  try {
    let query = {};

    const iataParam = req.query.iata;
    const queryParam = req.query.query;

    if (iataParam) {
      query = { iata_code: iataParam.toUpperCase() };
    } else if (queryParam) {
      const regex = new RegExp("^" + queryParam, 'i');
      query = { $or: [{ iata_code: regex }, { name: regex }, { city: regex }, { country: regex }] };
    }

    const airports = await airportsCollection.find(query).limit(iataParam || queryParam ? 7 : 0).toArray();
    res.json(airports);
  } catch (error) {
    res.status(500).send('Error fetching airports data');
  }
});

app.get('/routes', async (req, res) => {
  try {
      const routes = await routesCollection.find({}).toArray();
      const airports = await airportsCollection.find({}).toArray();

      const airportMap = airports.reduce((map, airport) => {
          map[airport.iata_code] = airport;
          return map;
      }, {});

      const enrichedRoutes = routes.map(route => {
          return {
              ...route,
              originAirport: airportMap[route.origin],
              destinationAirport: airportMap[route.destination]
          };
      });

      res.status(200).json(enrichedRoutes);
  } catch (e) {
      console.error(e);
      res.status(500).send("Error fetching routes data");
  }
})

app.get('/flights', async (req, res) => {
  try {
    const { origin, destination } = req.query;

    // Check if both origin and destination are provided
    if (!origin || !destination) {
      return res.status(400).send('Both origin and destination are required');
    }

    const query = {
      origin_iata: origin.toUpperCase(),
      dest_iata: destination.toUpperCase()
    };

    const flights = await flightsCollection.find(query).toArray();
    res.status(200).json(flights);
  } catch (e) {
    console.error(e);
    res.status(500).send("Error fetching flights data");
  }
});

function findCheapestRoutes(routes, origin, destination) {
  let costs = {};
  let paths = {};

  try {
    // Initialize costs and paths
    routes.forEach(route => {
      if (!costs[route.origin]) {
        costs[route.origin] = { totalCost: Infinity, segments: [] };
        paths[route.origin] = [];
      }
      if (!costs[route.destination]) {
        costs[route.destination] = { totalCost: Infinity, segments: [] };
        paths[route.destination] = [];
      }
    });

    // Set the starting point
    costs[origin] = { totalCost: 0, segments: [] };
    paths[origin] = [origin];

    // Calculate the cheapest paths
    for (let i = 0; i < routes.length; i++) {
      let updated = false;

      routes.forEach(route => {
        let newCost = parseFloat((costs[route.origin].totalCost + route.price).toFixed(2));
        if (newCost < costs[route.destination].totalCost) {
          costs[route.destination].totalCost = newCost;
          costs[route.destination].segments = [...costs[route.origin].segments, { from: route.origin, to: route.destination, price: parseFloat(route.price.toFixed(2)) }];
          paths[route.destination] = [...paths[route.origin], route.destination];
          updated = true;
        }
      });

      if (!updated) break;
    }

    // Filter routes that start with the origin and end with the destination
    let validRoutes = Object.keys(paths)
      .filter(key => paths[key][0] === origin && paths[key][paths[key].length - 1] === destination)
      .map(key => ({
        route: paths[key],
        totalCost: costs[key].totalCost,
        segmentCosts: costs[key].segments
      }));

    // Sort by total cost and return the top 3 cheapest routes
    return validRoutes.sort((a, b) => a.totalCost - b.totalCost).slice(0, 3);
  } catch (error) {
    console.error("Error in findCheapestRoutes function:", error);
    throw error; // Re-throw the error to be caught by the caller
  }
}

app.get('/cheapest-routes', async (req, res) => {
  const origin = req.query.origin;
  const destination = req.query.destination;

  if (!origin || !destination) {
    return res.status(400).send('Origin and destination IATA codes are required');
  }

  try {
    const routes = await routesCollection.find({}).toArray();
    let cheapestRoutes = findCheapestRoutes(routes, origin, destination);
    res.json(cheapestRoutes);
  } catch (error) {
    console.error("Error in /cheapest-routes endpoint:", error);
    res.status(500).send('Error searching for cheapestRoutes');
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

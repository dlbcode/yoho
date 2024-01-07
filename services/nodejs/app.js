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

app.get('/cheapest-routes', async (req, res) => {
  const origin = req.query.origin;
  const destination = req.query.destination;

  if (!origin || !destination) {
      return res.status(400).send('Origin and destination IATA codes are required');
  }

  try {
      const routes = await routesCollection.find({}).toArray();
      let cheapestRoutes = findCheapestRoutes(routes, origin, destination);
      routes = cheapestRoutes.slice(0, 3); // Get top 3 cheapest routes

      res.json(cheapestRoutes);
  } catch (error) {
      console.error(error);
      res.status(500).send('Error searching for cheapestRoutes');
  }
});

function findCheapestRoutes(routes, origin, destination) {
  let costs = {};
  let paths = {};

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

  costs[origin] = { totalCost: 0, segments: [] };
  paths[origin] = [origin];

  routes.forEach(route => {
      if (!costs[route.origin] || !costs[route.destination]) {
          console.error(`Missing cost or path initialization for route:`, route);
      }
  });

  for (let i = 0; i < routes.length; i++) {
      let updated = false;

      routes.forEach(route => {
          let newCost = costs[route.origin].totalCost + route.price;
          if (newCost < costs[route.destination].totalCost) {
              costs[route.destination].totalCost = newCost;
              costs[route.destination].segments = [...costs[route.origin].segments, { from: route.origin, to: route.destination, price: route.price }];
              paths[route.destination] = [...paths[route.origin], route.destination];
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

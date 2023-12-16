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

// Endpoint to get airports data
app.get('/airports', async (req, res) => {
  try {
    const queryParam = req.query.query;
    let query = {};

    if (queryParam) {
      // Create a case-insensitive regex pattern to filter airports
      const regex = new RegExp(queryParam, 'i');
      
      // Prioritize iata_code in the query
      query = {
        $or: [
          { iata_code: regex },
          { $and: [{ iata_code: { $not: regex } }, { $or: [{ name: regex }, { city: regex }, { country: regex }] }] }
        ]
      };
    }

    const airports = await airportsCollection.find(query).limit(7).toArray(); // Limit the results to 7
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

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

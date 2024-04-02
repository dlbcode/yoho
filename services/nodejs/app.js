const express = require('express');
//const Amadeus = require('amadeus');
const axios = require('axios');
const MongoClient = require('mongodb').MongoClient;
const app = express();
const port = 3000;
const cors = require('cors');
const mongodbPassword = process.env.MONGO_RSUSER_PASSWORD;

const TEQUILA_API_KEY = process.env.TEQUILA_API_KEY || 'your_default_api_key';

const tequila = {
  method: 'get',
  url: 'https://api.tequila.kiwi.com/search',
  headers: {
    'apikey': TEQUILA_API_KEY,
  },
};

app.use(cors({
  origin: [
    'http://www.yonderhop.com',
    'https://www.yonderhop.com',
    'http://yonderhop.com',
    'https://yonderhop.com'
  ]
}));

const mongoUrl = `mongodb://rsuser:${mongodbPassword}@mongodb:27017/rsdb`;
const dbName = 'rsdb';

let db;
let airportsCollection;
let routesCollection;

MongoClient.connect(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true }, (err, client) => {
  if (err) throw err;

  db = client.db(dbName);
  airportsCollection = db.collection('airports');
  routesCollection = db.collection('directRoutes');
  flightsCollection = db.collection('flights');
  console.log('Connected to MongoDB');

  const airports = require('./api/airports');
  airports(app, airportsCollection);

  const directRoutes = require('./api/directRoutes');
  directRoutes(app, airportsCollection, routesCollection);

  const flights = require('./api/flights');
  flights(app, flightsCollection);

  const cheapestFlights = require('./api/cheapestFlights');
  cheapestFlights(app, db, tequila);

  const aggregateRoutes = require('./api/aggregateRoutes');
  aggregateRoutes(app, airportsCollection, routesCollection);

  const yhonewayandreturn = require('./api/yhonewayandreturn');
  yhonewayandreturn(app, axios, db, tequila);

  const range = require('./api/range');
  range(app, db, tequila);

}); 

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

module.exports = function(app, routesCollection, amadeus) {
  app.get('/atdRoutes', async (req, res) => {
  try {
    const { origin, destination, tripType } = req.query;

    if (!origin || !destination) {
      return res.status(400).send('Origin and destination IATA codes are required');
    }

    const flightSearchParams = { // Set up parameters for Amadeus API request
      originLocationCode: origin,
      destinationLocationCode: destination,
      departureDate: '2024-02-15', // Example date, adjust as needed
      adults: '1'
    };

    if (tripType && tripType.toUpperCase() === 'ROUNDTRIP') { // Add return date only for round-trip flights
      flightSearchParams.returnDate = '2024-02-22'; // Example return date, adjust as needed
    }

    const response = await amadeus.shopping.flightOffersSearch.get(flightSearchParams);

    for (const offer of response.data) {
      for (const itinerary of offer.itineraries) {
        if (itinerary.segments.length === 1) { // Check for direct flight
          const segment = itinerary.segments[0];
          const routeQuery = { origin: segment.departure.iataCode, destination: segment.arrival.iataCode };
          const existingRoute = await routesCollection.findOne(routeQuery);

          if (existingRoute && offer.price.total < existingRoute.price) {
            const updateData = {
              price: offer.price.total,
              carrierCode: segment.carrierCode,
              departure: segment.departure,
              arrival: segment.arrival,
              source: 'atd' // Set source to 'atd'
            };
            await routesCollection.updateOne(routeQuery, { $set: updateData }, { upsert: true });
          }
        }
      }
    }

    res.json(response.data);
  } catch (error) {
    console.error('Error fetching flight offers:', error);
    res.status(500).send('Error fetching flight offers');
  }
});
}
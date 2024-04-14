async function updateDirectRoutes(db, flightData) {
  for (const flight of flightData) {
    console.log('flight', flight);
    const existingDirectRoute = await db.collection('directRoutes').findOne({
      origin: flight.origin,
      destination: flight.destination
    });

    if (existingDirectRoute) {
      if (existingDirectRoute.price > flight.price) {
        console.log(`Updating direct route from ${flight.origin} to ${flight.destination} with lower price: ${flight.price}`);
        await db.collection('directRoutes').updateOne(
          { _id: existingDirectRoute._id },
          { $set: {
              price: flight.price,
              date: flight.departureDate,
              timestamp: new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14),
              source: 'tequila'
            }
          }
        );
      }
    } else {
      console.log(`Inserting new direct route from ${flight.origin} to ${flight.destination}`);
      await db.collection('directRoutes').insertOne({
        origin: flight.origin,
        destination: flight.destination,
        price: flight.price,
        date: flight.departureDate,
        timestamp: new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14),
        source: 'tequila'
      });
    }
  }
}

module.exports = updateDirectRoutes;
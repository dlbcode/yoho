async function updateDirectRoutes(db, sortedFlights) {
  for (const flight of sortedFlights) {
    for (const route of flight.route) {
      const existingDirectRoute = await db.collection('directRoutes').findOne({
        origin: route.flyFrom,
        destination: route.flyTo
      });

      if (existingDirectRoute) {
        if (existingDirectRoute.price > flight.price) {
          console.log(`Updating direct route from ${route.flyFrom} to ${route.flyTo} with lower price: ${flight.price}`);
          await db.collection('directRoutes').updateOne(
            { _id: existingDirectRoute._id },
            { $set: {
                price: flight.price,
                timestamp: new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14),
                source: 'tequila'
              }
            }
          );
        } else {
          await db.collection('directRoutes').insertOne({
            origin: route.flyFrom,
            destination: route.flyTo,
            price: flight.price,
            timestamp: new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14),
            source: 'tequila'
          });
        }
      }
    }
  }
}

module.exports = updateDirectRoutes;

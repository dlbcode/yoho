// services/nodejs/api/directRouteHandler.js

async function updateDirectRoutes(db, sortedFlights) {
  console.log('Checking direct flights');
  for (const flight of sortedFlights) {
    for (const route of flight.route) {
      const existingDirectRoute = await db.collection('directRoutes').findOne({
        origin: route.flyFrom,
        destination: route.flyTo
      });
      console.log('Existing direct route:', existingDirectRoute);

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
          console.log(`Existing price for direct route from ${route.flyFrom} to ${route.flyTo} is lower or equal; no update needed.`);
        }
      } else {
        console.log(`No existing direct route found for ${route.flyFrom} to ${route.flyTo}; inserting new one for: ${flight.price}`);
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

module.exports = updateDirectRoutes;

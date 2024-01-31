module.exports = function(app, routesCollection) {
  app.get('/cheapestRoutes', async (req, res) => {
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

  function findCheapestRoutes(routes, origin, destination) {
    let costs = {};
    let paths = {};
  
    try {
      // Initialize costs and paths
      routes.forEach(route => {
        if (!costs[route.origin]) {
          costs[route.origin] = { totalCost: Infinity };
          paths[route.origin] = [];
        }
        if (!costs[route.destination]) {
          costs[route.destination] = { totalCost: Infinity };
          paths[route.destination] = [];
        }
      });
  
      costs[origin] = { totalCost: 0 }; // Set the starting point
      paths[origin] = [origin];
  
      for (let i = 0; i < routes.length; i++) {
        let updated = false;
  
        routes.forEach(route => {
          let newCost = parseFloat((costs[route.origin].totalCost + route.price).toFixed(2));
          if (newCost < costs[route.destination].totalCost) {
            costs[route.destination].totalCost = newCost;
            paths[route.destination] = [...paths[route.origin], route.destination];
            updated = true;
          }
        });
  
        if (!updated) break;
      }
  
      let validRoutes = Object.keys(paths)
        .filter(key => paths[key][0] === origin && paths[key][paths[key].length - 1] === destination)
        .map(key => ({
          route: paths[key],
          totalCost: costs[key].totalCost
        }));
  
      return validRoutes.sort((a, b) => a.totalCost - b.totalCost).slice(0, 3); // Sort by total cost and return the top 3 cheapest routes
    } catch (error) {
      console.error("Error in findCheapestRoutes function:", error);
      throw error; // Re-throw the error to be caught by the caller
    }
  }  
}

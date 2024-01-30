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
      res.status(500).send('Error searching for cheapestRoutes: ' + error.message);
    }
  });

  function findCheapestRoutes(routes, origin, destination) {
    let allRoutes = {};
  
    // Initialize allRoutes with direct routes
    routes.forEach(route => {
      if (!allRoutes[route.origin]) {
        allRoutes[route.origin] = [];
      }
      allRoutes[route.origin].push({ to: route.destination, price: route.price });
    });
  
    // Function to find all possible paths from origin to destination
    function findAllPaths(currentPath, destination, visited, depth = 0, maxDepth = 4) {
      if (depth > maxDepth) {
        return []; // Exceeding max depth, return empty array
      }
    
      let lastNode = currentPath[currentPath.length - 1];
      if (lastNode === destination) {
        return [currentPath];
      }
    
      let paths = [];
      allRoutes[lastNode]?.forEach(nextRoute => {
        if (!visited.has(nextRoute.to)) {
          visited.add(nextRoute.to);
          let newPath = [...currentPath, nextRoute.to];
          paths.push(...findAllPaths(newPath, destination, new Set(visited), depth + 1, maxDepth));
          visited.delete(nextRoute.to);
        }
      });
    
      return paths;
    }    
  
    // Calculate the total cost of a path
    function calculatePathCost(path) {
      let totalCost = 0;
      for (let i = 0; i < path.length - 1; i++) {
        let segment = allRoutes[path[i]].find(route => route.to === path[i + 1]);
        totalCost += segment.price;
      }
      return totalCost;
    }
  
    // Find all paths and calculate their costs
    let validPaths = findAllPaths([origin], destination, new Set([origin]));
    let pathCosts = validPaths.map(path => ({
      route: path,
      totalCost: calculatePathCost(path)
    }));
  
    // Sort by total cost and return the top 3 cheapest routes
    return pathCosts.sort((a, b) => a.totalCost - b.totalCost).slice(0, 3);
  }  
}

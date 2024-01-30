const { PriorityQueue } = require('./priorityQueue.js');

module.exports = function(app, routesCollection) {
  app.get('/cheapestRoutes', async (req, res) => {
    const origin = req.query.origin;
    const destination = req.query.destination;

    if (!origin || !destination) {
      return res.status(400).send('Origin and destination IATA codes are required');
    }

    try {
      const routes = await routesCollection.find({}).toArray();
      const graph = buildGraph(routes);
      const cheapestRoutes = findCheapestRoutes(graph, origin, destination);
      res.json(cheapestRoutes);
    } catch (error) {
      console.error("Error in /cheapest-routes endpoint:", error);
      res.status(500).send('Error searching for cheapestRoutes: ' + error.message);
    }
  });

  function buildGraph(routes) {
    const graph = {};
    routes.forEach(route => {
      if (!graph[route.origin]) {
        graph[route.origin] = {};
      }
      graph[route.origin][route.destination] = route.price;
    });
    return graph;
  }

  function findCheapestRoutes(graph, origin, destination) {
    const originalCosts = {};
    const routes = [];
  
    // Initialize original costs
    for (let node in graph) {
      for (let neighbor in graph[node]) {
        originalCosts[`${node}-${neighbor}`] = graph[node][neighbor];
      }
    }
  
    for (let i = 0; i < 3; i++) {
      const { path, cost } = dijkstra(graph, origin, destination);
      if (!path) break; // No more routes found
      routes.push({ path, totalCost: cost });
  
      // Penalize the edges used in the found path to find alternative routes
      for (let j = 0; j < path.length - 1; j++) {
        graph[path[j]][path[j + 1]] *= 1.1; // Increase cost by 10%
      }
    }
  
    // Restore original costs
    for (let node in graph) {
      for (let neighbor in graph[node]) {
        graph[node][neighbor] = originalCosts[`${node}-${neighbor}`];
      }
    }
  
    return routes;
  }
  
  function dijkstra(graph, origin, destination) {
    const costs = {};
    const parents = {};
    const pq = new PriorityQueue((a, b) => costs[a] < costs[b]);
  
    for (let node in graph) {
      costs[node] = Infinity;
      parents[node] = null;
    }
  
    costs[origin] = 0;
    pq.enqueue(origin);
  
    while (!pq.isEmpty()) {
      const node = pq.dequeue();
  
      if (node === destination) {
        return {
          path: buildPath(parents, destination),
          cost: costs[destination]
        };
      }
  
      for (let neighbor in graph[node]) {
        const newCost = costs[node] + graph[node][neighbor];
        if (newCost < costs[neighbor]) {
          costs[neighbor] = newCost;
          parents[neighbor] = node;
          pq.enqueue(neighbor);
        }
      }
    }
  
    return { path: null, cost: 0 }; // No path found
  }
  
  function buildPath(parents, destination) {
    const path = [];
    let currentNode = destination;
    while (currentNode !== null) {
      path.unshift(currentNode);
      currentNode = parents[currentNode];
    }
    return path;
  }    
};

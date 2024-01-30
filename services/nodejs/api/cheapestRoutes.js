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
    const costs = {};
    const processed = new Set();
    const parents = {};
    const pq = new PriorityQueue((a, b) => costs[a] < costs[b]);
  
    Object.keys(graph).forEach(node => {
      if (node !== origin) {
        costs[node] = Infinity;
      }
    });
  
    costs[origin] = 0;
    pq.enqueue(origin);
  
    while (!pq.isEmpty()) {
      const node = pq.dequeue();
  
      if (node === destination) {
        break;
      }
  
      processed.add(node);
      const neighbors = graph[node];
      for (let n in neighbors) {
        if (!processed.has(n)) {
          const newCost = costs[node] + neighbors[n];
          if (newCost < (costs[n] || Infinity)) {
            costs[n] = newCost;
            parents[n] = node;
            pq.enqueue(n);
          }
        }
      }
    }
  
    return {
      path: buildPath(parents, destination),
      totalCost: costs[destination]
    };
  }
  
  function buildPath(parents, destination) {
    const path = [destination];
    let lastStep = destination;
    while (parents[lastStep]) {
      path.unshift(parents[lastStep]);
      lastStep = parents[lastStep];
    }
    return path;
  }  
};

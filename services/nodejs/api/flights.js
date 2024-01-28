module.exports = function(app, flightsCollection) {
  app.get('/flights', async (req, res) => {  try {
    const { origin, destination } = req.query;

    if (!origin || !destination) { // Check if both origin and destination are provided
      return res.status(400).send('Both origin and destination are required');
    }

    const query = {
      origin: origin.toUpperCase(),
      dest: destination.toUpperCase()
    };

    const flights = await flightsCollection.find(query).toArray();
    res.status(200).json(flights);
  } catch (e) {
    console.error(e);
    res.status(500).send("Error fetching flights data");
  }
});
}
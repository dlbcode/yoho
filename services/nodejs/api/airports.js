module.exports = function(app, airportsCollection) {
app.get('/airports', async (req, res) => {
  try {
    let query = {};

    const iataParam = req.query.iata;
    const queryParam = req.query.query;

    if (iataParam) {
      query = { iata_code: iataParam.toUpperCase() };
    } else if (queryParam) {
      const regex = new RegExp("^" + queryParam, 'i');
      query = { $or: [{ iata_code: regex }, { name: regex }, { city: regex }, { country: regex }] };
    }

    const airports = await airportsCollection.find(query).limit(iataParam || queryParam ? 7 : 0).toArray();
    res.json(airports);
  } catch (error) {
    res.status(500).send('Error fetching airports data');
  }
});
}
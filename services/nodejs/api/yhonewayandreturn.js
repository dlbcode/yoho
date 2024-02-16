module.exports = function(app) {
  // Endpoint for searching one-way flights
  app.get('/yhoneway', async (req, res) => {
    const { origin, destination, date } = req.query;

    if (!origin || !destination || !date) {
      return res.status(400).send('Origin, destination, and date are required');
    }

    const config = {
      method: 'get',
      url: `https://tequila-api.kiwi.com/v2/search?fly_from=${origin}&fly_to=${destination}&date_from=${date}&date_to=${date}&flight_type=oneway&partner=picky`,
      headers: { 
        'apikey': process.env.TEQUILA_API_KEY
      }
    };

    try {
      const response = await axios(config);
      res.json(response.data);
    } catch (error) {
      console.error(error);
      res.status(500).send("Error fetching one-way flights data");
    }
  });

  // Endpoint for searching return flights
  app.get('/yhreturn', async (req, res) => {
    const { origin, destination, departureDate, returnDate } = req.query;

    if (!origin || !destination || !departureDate || !returnDate) {
      return res.status(400).send('Origin, destination, departure date, and return date are required');
    }

    const config = {
      method: 'get',
      url: `https://tequila-api.kiwi.com/v2/search?fly_from=${origin}&fly_to=${destination}&date_from=${departureDate}&date_to=${returnDate}&flight_type=round&partner=picky`,
      headers: { 
        'apikey': process.env.TEQUILA_API_KEY
      }
    };

    try {
      const response = await axios(config);
      res.json(response.data);
    } catch (error) {
      console.error(error);
      res.status(500).send("Error fetching return flights data");
    }
  });
};

module.exports = function(app, axios, db, tequila) {
  app.get('/yhairports', async (req, res) => {
      const { iata } = req.query;
      if (!iata) {
          return res.status(400).send('IATA code is required');
      }

      const TEQUILA_API_KEY = process.env.TEQUILA_API_KEY;
      const url = `https://tequila-api.kiwi.com/locations/query?term=${iata}&location_types=airport`;

      try {
          const response = await axios.get(url, {
              headers: {
                  'apikey': TEQUILA_API_KEY,
              },
          });

          const airportData = response.data.locations.map(location => {
            // Safely access nested properties
            const city = location.city ? location.city.name : 'Unknown City';
            const country = location.city && location.city.country ? location.city.country.name : 'Unknown Country';
            const latitude = parseFloat(location.location.lat);
            const longitude = parseFloat(location.location.lon);
            // Invert rank value to match the 'weight' system
            const weight = 11 - location.rank;
        
            return {
                iata_code: location.code,
                city: city,
                country: country,
                latitude: latitude,
                longitude: longitude,
                name: location.name,
                type: location.type,
                weight: weight,
            };
          });               

          res.json(airportData[0] || {});
      } catch (error) {
          console.error('Error fetching airport data:', error);
          res.status(500).send('Error fetching airport data');
      }
  });
};

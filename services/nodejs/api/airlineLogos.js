const fs = require('fs');
const path = require('path');
const axios = require('axios');

module.exports = function(app) {
  const logoBaseDir = path.join(__dirname, '../../../../www/assets/airline_logos/70px');
  
  // Ensure the logo directory exists
  if (!fs.existsSync(logoBaseDir)) {
    fs.mkdirSync(logoBaseDir, { recursive: true });
  }
  
  app.get('/api/airline-logo/:code', async (req, res) => {
    const airlineCode = req.params.code.toUpperCase();
    const logoPath = path.join(logoBaseDir, `${airlineCode}.png`);
    
    // Check if we already have the logo
    if (fs.existsSync(logoPath)) {
      return res.sendFile(logoPath);
    }
    
    // Logo doesn't exist, try to fetch it
    try {
      const logoUrl = `https://www.gstatic.com/flights/airline_logos/70px/${airlineCode}.png`;
      const response = await axios({
        method: 'get',
        url: logoUrl,
        responseType: 'arraybuffer'
      });
      
      if (response.status === 200) {
        // Save the logo file
        fs.writeFileSync(logoPath, response.data);
        console.log(`Downloaded logo for airline: ${airlineCode}`);
        return res.sendFile(logoPath);
      } else {
        // Return a 404 if the logo couldn't be found
        return res.status(404).send('Airline logo not found');
      }
    } catch (error) {
      console.error(`Error fetching logo for ${airlineCode}:`, error.message);
      res.status(500).send('Error fetching airline logo');
    }
  });
};

const fs = require('fs');
const path = require('path');
const axios = require('axios');

module.exports = function(app) {
  // Find the best www root directory based on environment
  const wwwRoot = (() => {
    // Check production Docker environment
    if (process.env.NODE_ENV === 'production' && fs.existsSync('/usr/src/app/www')) {
      return '/usr/src/app/www';
    }
    
    // Try common paths
    const possiblePaths = [
      path.resolve(__dirname, '../../../../www'),
      '/var/www',
      '/usr/src/app/www',
      process.env.WWW_ROOT
    ];
    
    for (const testPath of possiblePaths) {
      if (testPath && fs.existsSync(testPath)) {
        return testPath;
      }
    }
    
    // Fallback to current directory
    const fallbackPath = path.join(process.cwd(), 'www');
    fs.mkdirSync(fallbackPath, { recursive: true });
    return fallbackPath;
  })();
  
  // Define asset paths
  const logoBaseDir = path.join(wwwRoot, 'assets/airline_logos/70px');
  const fallbackLogoPath = path.join(wwwRoot, 'assets/airline_logos/fallback_airline_logo.png');
  
  // Ensure directories exist
  [logoBaseDir, path.dirname(fallbackLogoPath)].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
  
  // Register the route for both paths to handle Nginx proxy configuration
  app.get('/api/airlineLogos/:code', handleLogoRequest);
  app.get('/airlineLogos/:code', handleLogoRequest);

  // Logo request handler
  async function handleLogoRequest(req, res) {
    const airlineCode = req.params.code.toUpperCase();
    const logoPath = path.join(logoBaseDir, `${airlineCode}.png`);
    
    // Return existing logo if available
    if (fs.existsSync(logoPath)) {
      return res.sendFile(logoPath);
    }
    
    try {
      // Fetch logo from Google's CDN
      const response = await axios({
        method: 'get',
        url: `https://www.gstatic.com/flights/airline_logos/70px/${airlineCode}.png`,
        responseType: 'arraybuffer',
        validateStatus: status => status < 500
      });
      
      if (response.status === 200) {
        // Save fetched logo and return it
        fs.writeFileSync(logoPath, response.data);
        return res.sendFile(logoPath);
      }
      
      // Logo not found on CDN, serve fallback
      return serveFallbackLogo(res);
    } catch (error) {
      // Handle errors by serving fallback logo
      return serveFallbackLogo(res);
    }
  }
  
  // Helper function to serve the fallback logo
  function serveFallbackLogo(res) {
    if (fs.existsSync(fallbackLogoPath)) {
      return res.sendFile(fallbackLogoPath);
    } else {
      // If fallback doesn't exist for some reason, send 404
      return res.status(404).send('Airline logo not found');
    }
  }
};
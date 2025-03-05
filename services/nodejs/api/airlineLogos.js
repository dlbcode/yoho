const fs = require('fs');
const path = require('path');
const axios = require('axios');

module.exports = function(app) {
  // Find www root and define asset paths
  const wwwRoot = findWwwRoot();
  const logoBaseDir = path.join(wwwRoot, 'assets/airline_logos/70px');
  const fallbackLogoPath = path.join(wwwRoot, 'assets/airline_logos/fallback_airline_logo.png');
  
  // Ensure directories exist at startup
  ensureDirectories();
  
  // Register routes for both direct and proxied access
  app.get('/api/airlineLogos/:code', handleLogoRequest);
  app.get('/airlineLogos/:code', handleLogoRequest);

  // Find the appropriate www root directory
  function findWwwRoot() {
    // Check production environment first (most common case)
    if (process.env.NODE_ENV === 'production' && fs.existsSync('/usr/src/app/www')) {
      return '/usr/src/app/www';
    }
    
    // Try commonly used paths
    for (const dir of [
      path.resolve(__dirname, '../../../../www'),
      process.env.WWW_ROOT,
      '/var/www',
      '/usr/src/app/www'
    ]) {
      if (dir && fs.existsSync(dir)) return dir;
    }
    
    // Fallback to local directory if nothing else found
    const fallback = path.join(process.cwd(), 'www');
    fs.mkdirSync(fallback, { recursive: true });
    return fallback;
  }
  
  // Create required directories if they don't exist
  function ensureDirectories() {
    for (const dir of [logoBaseDir, path.dirname(fallbackLogoPath)]) {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    }
  }

  // Handle airline logo requests
  async function handleLogoRequest(req, res) {
    const airlineCode = req.params.code.toUpperCase();
    const logoPath = path.join(logoBaseDir, `${airlineCode}.png`);
    
    // Return cached logo if available (fast path)
    if (fs.existsSync(logoPath)) {
      return res.sendFile(logoPath);
    }
    
    try {
      // Fetch from Google's CDN with timeout
      const response = await axios({
        method: 'get',
        url: `https://www.gstatic.com/flights/airline_logos/70px/${airlineCode}.png`,
        responseType: 'arraybuffer',
        validateStatus: status => status < 500,
        timeout: 2500, // Slightly reduced timeout for faster failure
        headers: {
          'Accept': 'image/png,image/*',
          'User-Agent': 'YonderHop/1.0'
        }
      });
      
      // If successful, save and return the logo
      if (response.status === 200) {
        // Write file asynchronously to avoid blocking the response
        fs.promises.writeFile(logoPath, response.data)
          .catch(err => console.error(`Error saving logo for ${airlineCode}:`, err));
        
        // Send response immediately without waiting for file write
        return res.type('image/png').send(response.data);
      }
      
      // Logo not found on CDN, use fallback
      return serveFallback();
    } catch (error) {
      return serveFallback();
    }
  }
  
  // Helper to serve fallback logo
  function serveFallback() {
    return fs.existsSync(fallbackLogoPath) 
      ? res.sendFile(fallbackLogoPath)
      : res.status(404).send('Airline logo not found');
  }
};
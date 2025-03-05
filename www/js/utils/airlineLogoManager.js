/**
 * Airline Logo Manager - Handles checking and loading airline logos
 * If a logo doesn't exist, it will fetch it from the server
 */

class AirlineLogoManager {
  constructor() {
    this.logoCache = new Map(); // Cache of logo URLs
    this.pendingRequests = new Map(); // Track in-flight requests
    this.loggedMissingLogos = new Set(); // Track logs to avoid duplicates
  }

  /**
   * Get logo URL for an airline, fetching from server if needed
   * @param {string} airlineCode - The IATA code for the airline
   * @returns {Promise<string>} - The URL to the airline logo
   */
  async getLogoUrl(airlineCode) {
    if (!airlineCode) return this.getFallbackLogoUrl();
    
    const normalizedCode = airlineCode.toUpperCase();
    
    // Return from cache if available
    if (this.logoCache.has(normalizedCode)) {
      return this.logoCache.get(normalizedCode);
    }
    
    // Return existing promise if request is in progress
    if (this.pendingRequests.has(normalizedCode)) {
      return this.pendingRequests.get(normalizedCode);
    }

    // Create promise to handle logo retrieval
    const logoPromise = this._fetchLogoUrl(normalizedCode);
    this.pendingRequests.set(normalizedCode, logoPromise);
    
    try {
      const logoUrl = await logoPromise;
      this.logoCache.set(normalizedCode, logoUrl);
      return logoUrl;
    } catch (error) {
      if (!this.loggedMissingLogos.has(normalizedCode)) {
        console.warn(`⚠️ Using fallback logo for airline ${normalizedCode}: ${error.message}`);
        this.loggedMissingLogos.add(normalizedCode);
      }
      
      const fallbackUrl = this.getFallbackLogoUrl();
      this.logoCache.set(normalizedCode, fallbackUrl);
      return fallbackUrl;
    } finally {
      this.pendingRequests.delete(normalizedCode);
    }
  }

  /**
   * Internal method to fetch logo URL
   * @private
   */
  async _fetchLogoUrl(airlineCode) {
    const standardLogoPath = `assets/airline_logos/70px/${airlineCode}.png`;
    
    // Check if logo exists locally
    if (await this._checkImageExists(standardLogoPath)) {
      return standardLogoPath;
    }
    
    // Log that we're looking for this logo
    if (!this.loggedMissingLogos.has(airlineCode)) {
      console.info(`🔍 Looking for airline logo: ${airlineCode}`);
    }
    
    // Fetch from API
    console.info(`� Fetching logo from API: /api/airlineLogos/${airlineCode}`);
    const response = await fetch(`/api/airlineLogos/${airlineCode}`);
    
    if (response.ok) {
      console.info(`✅ Retrieved logo for ${airlineCode}`);
      
      // Wait briefly to ensure the file is saved by the server
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Add cache busting parameter
      return `${standardLogoPath}?t=${Date.now()}`;
    } else {
      console.warn(`❌ API returned ${response.status} for airline logo: ${airlineCode}`);
      throw new Error(`API error: ${response.status}`);
    }
  }

  /**
   * Check if an image exists without causing 404 console errors
   * @private
   */
  async _checkImageExists(url) {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get a fallback logo URL
   */
  getFallbackLogoUrl() {
    return 'assets/airline_logos/fallback_airline_logo.png';
  }
}

// Create and export a singleton instance
export const airlineLogoManager = new AirlineLogoManager();
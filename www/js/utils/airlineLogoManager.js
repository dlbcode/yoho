/**
 * Airline Logo Manager - Handles checking and loading airline logos
 * If a logo doesn't exist, it will fetch it from the server
 */

class AirlineLogoManager {
  constructor() {
    this.logoCache = new Map(); // Cache to track logo status
    this.pendingRequests = new Map(); // Track in-flight requests
  }

  /**
   * Check if an airline logo exists, and fetch it if not
   * @param {string} airlineCode - The IATA code for the airline
   * @returns {Promise<string>} - The URL to the airline logo
   */
  async getLogoUrl(airlineCode) {
    if (!airlineCode) return this.getFallbackLogoUrl();

    const normalizedCode = airlineCode.toUpperCase();
    
    // Check if we've already verified this logo
    if (this.logoCache.has(normalizedCode)) {
      return this.logoCache.get(normalizedCode);
    }
    
    // Check if we have a request in progress for this logo
    if (this.pendingRequests.has(normalizedCode)) {
      return this.pendingRequests.get(normalizedCode);
    }

    const standardLogoPath = `assets/airline_logos/70px/${normalizedCode}.png`;
    const logoRequest = this.checkAndFetchLogo(normalizedCode, standardLogoPath);
    
    // Store the promise to prevent duplicate requests
    this.pendingRequests.set(normalizedCode, logoRequest);
    
    try {
      const logoUrl = await logoRequest;
      this.logoCache.set(normalizedCode, logoUrl);
      return logoUrl;
    } catch (error) {
      console.error(`Failed to load logo for ${normalizedCode}:`, error);
      const fallbackUrl = this.getFallbackLogoUrl();
      this.logoCache.set(normalizedCode, fallbackUrl);
      return fallbackUrl;
    } finally {
      this.pendingRequests.delete(normalizedCode);
    }
  }

  /**
   * Check if the logo exists locally, fetch from server if it doesn't
   * @param {string} airlineCode - The airline code
   * @param {string} standardPath - The standard path to the logo
   * @returns {Promise<string>} - The URL to the logo
   */
  async checkAndFetchLogo(airlineCode, standardPath) {
    // First try to load the standard path to see if it exists
    try {
      const exists = await this.imageExists(standardPath);
      if (exists) {
        return standardPath; // Logo already exists locally
      }
    } catch (error) {
      console.log(`Logo doesn't exist locally for ${airlineCode}, will fetch from server`);
    }

    // Logo doesn't exist, request it from our API
    const apiUrl = `/api/airline-logo/${airlineCode}`;
    
    try {
      // Make a HEAD request to trigger logo fetching and saving
      await fetch(apiUrl, { method: 'HEAD' });
      
      // Now the logo should be available at the standard path
      return standardPath;
    } catch (error) {
      throw new Error(`Failed to fetch logo for ${airlineCode}`);
    }
  }

  /**
   * Check if an image exists at the given URL
   * @param {string} url - The URL to check
   * @returns {Promise<boolean>} - Whether the image exists
   */
  imageExists(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => reject(false);
      img.src = url;
    });
  }

  /**
   * Get a fallback logo URL for when an airline logo can't be loaded
   * @returns {string} - URL to a fallback logo
   */
  getFallbackLogoUrl() {
    return 'assets/airline_logos/fallback-airline-logo.png';
  }
}

// Create and export a singleton instance
export const airlineLogoManager = new AirlineLogoManager();

/**
 * Airline Logo Manager - Handles checking and loading airline logos
 * If a logo doesn't exist, it will fetch it from the server
 */

class AirlineLogoManager {
  constructor() {
    this.logoCache = new Map(); // Cache to track logo status
    this.pendingRequests = new Map(); // Track in-flight requests
    this.loggedMissingLogos = new Set(); // Track logos we've already logged warnings for
    this.preloadedImages = new Map(); // Cache of preloaded images to avoid 404s
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

    // Create a new promise for this request and store it immediately
    // This will ensure all concurrent calls for the same airline code
    // receive the same promise
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
   * Internal method to fetch logo URL, separated to improve code organization
   * @param {string} airlineCode - The normalized airline code
   * @returns {Promise<string>} - The logo URL
   * @private
   */
  async _fetchLogoUrl(airlineCode) {
    const standardLogoPath = `assets/airline_logos/70px/${airlineCode}.png`;
    
    // First check if the logo already exists locally
    try {
      const exists = await this.imageExists(standardLogoPath);
      if (exists) {
        // Logo exists locally, no need for API call
        return standardLogoPath;
      }
      
      // Only log that we're looking if the logo doesn't exist locally
      if (!this.loggedMissingLogos.has(airlineCode)) {
        console.info(`🔍 Looking for airline logo: ${airlineCode}`);
      }
    } catch (error) {
      // Error checking if logo exists, continue to API
      if (!this.loggedMissingLogos.has(airlineCode)) {
        console.info(`🔍 Looking for airline logo: ${airlineCode}`);
      }
    }
    
    // At this point we know the logo doesn't exist locally, so go to API
    const apiUrl = `/api/airlineLogos/${airlineCode}`;
    
    try {
      // Make a GET request to fetch the logo
      console.info(`📡 Fetching logo from API: ${apiUrl}`);
      const response = await fetch(apiUrl);
      
      if (response.ok) {
        console.info(`✅ Successfully retrieved logo for ${airlineCode}`);
        
        // We got a successful response, so the image should now exist at standardLogoPath
        // Preload it to ensure it's in the browser cache
        try {
          await this.preloadImage(standardLogoPath);  // FIX: changed standardPath to standardLogoPath
        } catch (preloadError) {
          // If preloading fails, use the fallback (should rarely happen)
          console.warn(`❌ Preload failed for ${airlineCode}: ${preloadError.message}`);
          throw new Error(`Logo preload failed: ${preloadError.message}`);
        }
        
        // Add cache busting parameter
        return `${standardLogoPath}?t=${Date.now()}`;
      } else {
        // The API returned an error, likely the airline logo doesn't exist
        console.warn(`❌ API returned ${response.status} for airline logo: ${airlineCode}`);
        throw new Error(`API error: ${response.status}`);
      }
    } catch (error) {
      throw new Error(`Airline logo not available: ${error.message}`);
    }
  }

  /**
   * Check if an image exists at the given URL without causing a 404 console error
   * @param {string} url - The URL to check
   * @returns {Promise<boolean>} - Whether the image exists
   */
  imageExists(url) {
    return new Promise((resolve, reject) => {
      // Use fetch to check if the image exists without showing 404 in console
      fetch(url, { method: 'HEAD' })
        .then(response => {
          resolve(response.ok);
        })
        .catch(() => {
          // If there's an error (like CORS), assume the image doesn't exist
          resolve(false);
        });
    });
  }

  /**
   * Preload an image to ensure it exists in browser cache
   * @param {string} url - The URL to preload
   * @returns {Promise<void>}
   */
  preloadImage(url) {
    // If we've already preloaded this image, return cached promise
    if (this.preloadedImages.has(url)) {
      return this.preloadedImages.get(url);
    }

    // Create a new promise to preload the image
    const preloadPromise = new Promise((resolve, reject) => {
      // Use fetch API with blob to avoid 404 console errors
      fetch(url, { method: 'GET', cache: 'no-cache' })
        .then(response => {
          if (!response.ok) {
            throw new Error(`Failed to load image: ${url}`);
          }
          return response.blob();
        })
        .then(blob => {
          // Create an image element to fully load the blob
          const img = new Image();
          const blobUrl = URL.createObjectURL(blob);
          
          img.onload = () => {
            URL.revokeObjectURL(blobUrl);
            resolve();
          };
          
          img.onerror = () => {
            URL.revokeObjectURL(blobUrl);
            reject(new Error('Image failed to load from blob'));
          };
          
          img.src = blobUrl;
        })
        .catch(error => {
          reject(error);
        });
    });
    
    // Store the promise
    this.preloadedImages.set(url, preloadPromise);
    
    return preloadPromise;
  }

  /**
   * Get a fallback logo URL for when an airline logo can't be loaded
   * @returns {string} - URL to a fallback logo
   */
  getFallbackLogoUrl() {
    return 'assets/airline_logos/fallback_airline_logo.png';
  }
}

// Create and export a singleton instance
export const airlineLogoManager = new AirlineLogoManager();
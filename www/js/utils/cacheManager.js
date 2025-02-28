/**
 * Cache manager utility to handle localStorage operations and prevent quota errors
 */
const cacheManager = {
    // Default cache duration of 24 hours in milliseconds
    cacheDuration: 24 * 60 * 60 * 1000,
    
    /**
     * Store data in localStorage with error handling
     * @param {string} key - The key to store the data under
     * @param {any} data - The data to store
     * @param {number} timestamp - The timestamp for when the data was retrieved
     * @returns {boolean} - Success status
     */
    storeInCache(key, data, timestamp = Date.now()) {
        try {
            const item = JSON.stringify({ data, timestamp });
            localStorage.setItem(key, item);
            return true;
        } catch (error) {
            if (error.name === 'QuotaExceededError') {
                console.warn('Storage quota exceeded, clearing old cache entries');
                this.clearOldCacheEntries();
                
                // Try again after clearing
                try {
                    const item = JSON.stringify({ data, timestamp });
                    localStorage.setItem(key, item);
                    return true;
                } catch (retryError) {
                    console.error('Still cannot store in localStorage after cleanup', retryError);
                    return false;
                }
            }
            console.error('Error storing in cache:', error);
            return false;
        }
    },
    
    /**
     * Get data from localStorage
     * @param {string} key - The key to retrieve
     * @param {number} maxAge - Maximum age of the data in milliseconds
     * @returns {any|null} - The stored data or null if not found/expired
     */
    getFromCache(key, maxAge = this.cacheDuration) {
        try {
            const item = localStorage.getItem(key);
            if (!item) return null;
            
            const parsedItem = JSON.parse(item);
            
            // Check if the data is still fresh
            if (Date.now() - parsedItem.timestamp > maxAge) {
                localStorage.removeItem(key);
                return null;
            }
            
            return parsedItem.data;
        } catch (error) {
            console.error('Error retrieving from cache:', error);
            return null;
        }
    },
    
    /**
     * Clear old or invalid entries from localStorage
     */
    clearOldCacheEntries() {
        const now = Date.now();
        const keysToRemove = [];
        
        // Find keys to remove - focus on route cache entries
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            
            // Focus on our route cache entries
            if (key.startsWith('routes_')) {
                try {
                    const item = localStorage.getItem(key);
                    if (!item) {
                        keysToRemove.push(key);
                        continue;
                    }
                    
                    const data = JSON.parse(item);
                    
                    // Remove entries older than the cache duration
                    if (data.timestamp && (now - data.timestamp > this.cacheDuration)) {
                        keysToRemove.push(key);
                    }
                } catch (e) {
                    // If we can't parse it, it's probably corrupted
                    keysToRemove.push(key);
                }
            }
        }
        
        // Now remove the old entries
        keysToRemove.forEach(key => {
            localStorage.removeItem(key);
        });
        
        console.log(`Cleared ${keysToRemove.length} old cache entries`);
    },
    
    /**
     * Optimize route data by removing unnecessary fields
     * @param {Array} routes - The routes data to optimize
     * @returns {Array} - Optimized routes data
     */
    optimizeRouteData(routes) {
        if (!Array.isArray(routes)) return routes;
        
        return routes.map(route => ({
            // Keep essential data and remove redundant or large nested objects
            origin: route.originAirport?.iata_code,
            destination: route.destinationAirport?.iata_code,
            price: route.price,
            airlines: route.airlines,
            deep_link: route.deep_link,
            
            // Keep only necessary airport data
            originAirport: route.originAirport ? {
                iata_code: route.originAirport.iata_code,
                city: route.originAirport.city,
                latitude: route.originAirport.latitude,
                longitude: route.originAirport.longitude
            } : null,
            
            destinationAirport: route.destinationAirport ? {
                iata_code: route.destinationAirport.iata_code,
                city: route.destinationAirport.city,
                latitude: route.destinationAirport.latitude,
                longitude: route.destinationAirport.longitude
            } : null
        }));
    }
};

export { cacheManager };
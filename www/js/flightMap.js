import { map, blueDotIcon, magentaDotIcon, greenDotIcon } from './map.js';
import { pathDrawing } from './pathDrawing.js';
import { eventManager } from './eventManager.js';
import { appState, updateState } from './stateManager.js';
import { lineManager } from './lineManager.js';
import { cacheManager } from './utils/cacheManager.js';

const flightMap = {
    markers: {},
    airportDataCache: {},
    cacheDuration: 3600000, // Increase from 10 minutes to 1 hour
    hoverDisabled: false, // Add this flag
    preservedMarker: null,  // Add tracking for preserved marker
    hoverTimeout: null, // Add hoverTimeout to debounce hover events
    clearHoverLinesTimeout: null, // Add a timeout for debouncing the clearing

    init() {
        if (typeof map !== 'undefined') {
            this.getAirportDataByIata = this.getAirportDataByIata.bind(this);
            this.updateVisibleMarkers = this.updateVisibleMarkers.bind(this);

            map.on('zoomend', this.updateVisibleMarkers);
            map.on('moveend', this.updateVisibleMarkers);

            cacheManager.clearOldCacheEntries();

            this.fetchAndDisplayAirports();
        } else {
            console.error('Map is not defined');
        }
    },

    addMarker(airport) {
        if (!airport || !airport.iata_code || !airport.weight) {
            console.error('Incomplete airport data:', airport);
            return;
        }

        const iata = airport.iata_code;
        if (this.markers[iata]) return;

        const icon = this.getMarkerIcon(iata, airport.type);
        const latLng = L.latLng(airport.latitude, airport.longitude);
        const marker = L.marker(latLng, { icon });
        marker.airportWeight = airport.weight;
        marker.iata_code = iata;

        const popupContent = `<div style="text-align: center; color: #bababa;"><b>${airport.city}</b>${airport.type === 'airport' ? `<div>${airport.name}</div>` : ''}</div>`;
        marker.bindPopup(popupContent, { maxWidth: 'auto' });

        eventManager.attachMarkerEventListeners(iata, marker, airport);
        this.markers[iata] = marker;

        if (this.shouldDisplayAirport(marker.airportWeight, map.getZoom())) {
            marker.addTo(map);
        }
    },

    getMarkerIcon(iata, type) {
        if (type === 'city') return greenDotIcon;
        
        // Check if this iata is in any valid route as origin or destination in routeData
        const isInRoute = appState.routeData.some(route => 
            route && !route.isEmpty && (
                (route.origin && route.origin.iata_code === iata) || 
                (route.destination && route.destination.iata_code === iata)
            )
        );
        
        return isInRoute ? magentaDotIcon : blueDotIcon;
    },

    handleMarkerClick(airport, clickedMarker) {
        // Set flag to prevent map view changes
        appState.preventMapViewChange = true;
        
        // Store current map view before any operations
        const currentCenter = map.getCenter();
        const currentZoom = map.getZoom();
        
        // Continue with normal marker click handling
        Object.values(this.markers).forEach(marker => marker.closePopup());
        this.preservedMarker = clickedMarker;
        this.hoverDisabled = true;
        updateState('selectedAirport', airport);

        // Create popup content with add/remove button
        const popupContent = document.createElement('div');
        const cityName = document.createElement('p');
        cityName.textContent = airport.city;
        popupContent.appendChild(cityName);

        // Check if the airport is part of a route in routeData
        const routeInfo = this.findAirportInRouteData(airport.iata_code);
        const button = document.createElement('button');
        button.className = 'tooltip-button';
        button.textContent = routeInfo === -1 ? '+' : '-';

        button.addEventListener('click', () => {
            const currentRouteInfo = this.findAirportInRouteData(airport.iata_code);
            
            if (currentRouteInfo === -1) {
                // Add to a route
                if (appState.routeData.length > 0) {
                    // Find last route that's incomplete
                    const lastRouteIndex = appState.routeData.length - 1;
                    const lastRoute = appState.routeData[lastRouteIndex];
                    
                    if (!lastRoute || lastRoute.isEmpty || (!lastRoute.origin && !lastRoute.destination)) {
                        // Create new route with this as origin
                        this.addToNewRoute(airport, true);
                    } else if (lastRoute.origin && !lastRoute.destination) {
                        // Complete the route with this as destination
                        this.addAsDestination(lastRouteIndex, airport);
                    } else {
                        // Start a new route
                        this.addToNewRoute(airport, true);
                    }
                } else {
                    // Create first route
                    this.addToNewRoute(airport, true);
                }
                
                clickedMarker.setIcon(magentaDotIcon);
                button.textContent = '-';
            } else {
                // Extract routeIndex and isOrigin from the object returned by findAirportInRouteData
                const { routeIndex, isOrigin } = currentRouteInfo;
                const route = appState.routeData[routeIndex];
                
                if (isOrigin) {
                    // If removing origin and destination exists, update routeData
                    if (route.destination) {
                        updateState('updateRouteData', {
                            routeNumber: routeIndex,
                            data: {
                                origin: null
                            }
                        }, 'flightMap.handleMarkerClick.removeOrigin');
                    } else {
                        // Remove whole route if it's just an origin
                        updateState('removeRoute', {
                            routeNumber: routeIndex
                        }, 'flightMap.handleMarkerClick.removeRoute');
                    }
                } else {
                    // If removing destination, just remove the destination
                    updateState('updateRouteData', {
                        routeNumber: routeIndex,
                        data: {
                            destination: null
                        }
                    }, 'flightMap.handleMarkerClick.removeDestination');
                }
                
                lineManager.clearLines('hover');
                clickedMarker.setIcon(blueDotIcon);
                this.hoverDisabled = false;
                button.textContent = '+';
            }
            
            updateState('selectedAirport', null);
        });

        popupContent.appendChild(button);
        
        // Fix: Set closeOnClick to false to prevent popup from closing when clicked
        clickedMarker.bindPopup(popupContent, { 
            autoClose: false, 
            closeOnClick: false  // Changed from true to false
        }).openPopup();

        // Move line drawing after popup is bound
        this.fetchAndCacheRoutes(airport.iata_code).then(routes => {
            if (!routes || !routes.length) {
                console.error('Direct routes not found for IATA:', airport.iata_code);
                return;
            }

            // Clear any existing route popups and hover lines
            lineManager.clearLines('hover');
            lineManager.clearPopups('route');

            // Construct the directRoutes object expected by pathDrawing.drawRoutePaths
            const directRoutes = {
                [airport.iata_code]: routes.map(route => ({
                    destinationAirport: {
                        iata_code: route.destination,
                        city: route.cityTo,
                        name: route.nameTo
                    },
                    price: route.price,
                    date: route.date
                }))
            };

            // Draw direct route lines and set popupFromClick
            pathDrawing.drawRoutePaths(airport.iata_code, directRoutes, 'route');
            pathDrawing.popupFromClick = true;

            // Show the marker's popup
            clickedMarker.openPopup();

            // Listen for clicks outside popups/markers to clear lines
            setTimeout(() => {
                document.addEventListener('click', lineManager.outsideClickListener);
            }, 10);

            // After operations complete, restore map view if it changed
            setTimeout(() => {
                if (appState.preventMapViewChange && 
                    (!map.getCenter().equals(currentCenter) || map.getZoom() !== currentZoom)) {
                    map.setView(currentCenter, currentZoom, { animate: false });
                }
                appState.preventMapViewChange = false;
            }, 100);
        });
    },

    findAirportInRouteData(iata) {
        for (let i = 0; i < appState.routeData.length; i++) {
            const route = appState.routeData[i];
            if (!route || route.isEmpty) continue;
            
            if (route.origin && route.origin.iata_code === iata) {
                return { routeIndex: i, isOrigin: true };
            }
            
            if (route.destination && route.destination.iata_code === iata) {
                return { routeIndex: i, isOrigin: false };
            }
        }
        return -1;
    },
    
    addToNewRoute(airport, asOrigin) {
        const newRouteIndex = appState.routeData.length;
        const newRoute = {
            tripType: 'oneWay',
            travelers: 1,
        };
        
        if (asOrigin) {
            newRoute.origin = airport;
        } else {
            newRoute.destination = airport;
        }
        
        // Use updateRouteData instead of updateWaypoint
        updateState('updateRouteData', {
            routeNumber: newRouteIndex,
            data: newRoute
        }, 'flightMap.addToNewRoute');
    },
    
    addAsDestination(routeIndex, airport) {
        // Update route data directly
        updateState('updateRouteData', {
            routeNumber: routeIndex,
            data: {
                destination: airport
            }
        }, 'flightMap.addAsDestination');
    },

    async fetchAndDisplayAirports() {
        try {
            const currentZoom = map?.getZoom();
            if (currentZoom !== undefined) {
                await this.fetchAndCacheAirports(currentZoom);
                this.updateVisibleMarkers();
            } else {
                console.error('Map is not ready');
            }
        } catch (error) {
            console.error('Error fetching airports:', error);
        }
    },

    async fetchAndCacheAirports(currentZoom) {
        const cacheKey = `airports_${currentZoom}`;
        const cachedData = localStorage.getItem(cacheKey); 
        
        if (cachedData && (Date.now() - JSON.parse(cachedData).timestamp < this.cacheDuration)) {
            const { data } = JSON.parse(cachedData); 
            this.airportDataCache = data.reduce((acc, airport) => {
                acc[airport.iata_code] = airport;
                return acc;
            }, {});
            return this.airportDataCache;
        }
        
        try {
            const response = await fetch(`https://yonderhop.com/api/airports?zoom=${currentZoom}`);
            const data = await response.json();
            
            // Store the data in localStorage with a timestamp
            localStorage.setItem(cacheKey, JSON.stringify({ data, timestamp: Date.now() })); 

            this.airportDataCache = data.reduce((acc, airport) => {
                acc[airport.iata_code] = airport;
                return acc;
            }, {});
            
            return this.airportDataCache;
        } catch (error) {
            console.error('Error fetching airports:', error);
            return {};
        }
    },
    
    getAirportDataByIata(iata) {
        if (this.airportDataCache && this.airportDataCache[iata]) {
            return Promise.resolve(this.airportDataCache[iata]);
        }
    
        // Fetch and cache all airports if the specific IATA is not found
        return this.fetchAndCacheAirports(map?.getZoom()).then(cache => cache[iata] || null); 
    },

    getColorBasedOnPrice(price) {
        if (price === null || price === undefined || isNaN(parseFloat(price))) {
            return 'grey';
        }
        price = parseFloat(price);
        return price < 100 ? '#0099ff' : price < 200 ? 'green' : price < 300 ? '#abb740' : price < 400 ? 'orange' : price < 500 ? '#da4500' : '#c32929';
    },

    redrawMarkers() {
        Object.values(this.markers).forEach(marker => {
            const newLatLng = pathDrawing.adjustLatLng(marker.getLatLng());
            marker.setLatLng(newLatLng);
        });
    },

    markerHoverHandler(iata, event) {
        // Skip hover effects if an airport is selected or there's a preserved marker and this isn't it
        if (this.hoverDisabled || 
            appState.selectedAirport || 
            (this.preservedMarker && this.markers[iata] !== this.preservedMarker)) {
            return;
        }

        const marker = this.markers[iata];
        if (!marker) return;
        const airport = this.airportDataCache[iata];
        if (!airport) return;

        // Clear any existing hover timeout to prevent race conditions
        if (this.hoverTimeout) {
            clearTimeout(this.hoverTimeout);
            this.hoverTimeout = null;
        }

        if (event === 'mouseover') {
            // Show popup immediately for better responsiveness
            marker.openPopup();
            
            // Use a shorter timeout for route lines to improve responsiveness
            // but still prevent excessive API calls
            this.hoverTimeout = setTimeout(() => {
                this.fetchAndCacheRoutes(iata).then(routes => {
                    if (!routes || !routes.length) {
                        console.error('Direct routes not found for IATA:', iata);
                        return;
                    }
                    
                    // Skip drawing routes if the state changed while waiting
                    if (this.hoverDisabled || 
                        appState.selectedAirport || 
                        (this.preservedMarker && this.markers[iata] !== this.preservedMarker)) {
                        return;
                    }
                    
                    const directRoutes = {
                        [iata]: routes.map(route => ({
                            destinationAirport: {
                                iata_code: route.destination,
                                city: route.cityTo,
                                name: route.nameTo
                            },
                            price: route.price,
                            date: route.date
                        }))
                    };

                    lineManager.clearLines('hover');
                    
                    if (!this.preservedMarker || this.markers[iata] === this.preservedMarker) {
                        pathDrawing.drawRoutePaths(iata, directRoutes, 'hover');
                    }
                });
            }, 75); // Reduced from 150ms to 100ms for better responsiveness
            
        } else if (event === 'mouseout') {
            // Close popup immediately on mouseout
            marker.closePopup();
            
            // Clear any potential pending hover effect
            if (this.hoverTimeout) {
                clearTimeout(this.hoverTimeout);
                this.hoverTimeout = null;
            }
            
            // Only clear lines if there's no preserved marker
            if (!this.preservedMarker) {
                lineManager.clearLines('hover');
            }
        }
    },

    async fetchAndCacheRoutes(iata) {
        if (!iata) {
            console.error('IATA code is empty');
            return [];
        }

        try {
            // Add the direction parameter from appState
            const direction = appState.routeDirection || 'from';
            const response = await fetch(`https://yonderhop.com/api/directRoutes?origin=${iata}&direction=${direction}`);
            
            // Check response status before trying to parse JSON
            if (!response.ok) {
                console.error(`Error fetching routes: ${response.status} ${response.statusText}`);
                const text = await response.text();
                console.error(`Response text: ${text}`);
                return [];
            }
            
            try {
                const routes = await response.json();
                return Array.isArray(routes) ? routes : [];
            } catch (jsonError) {
                console.error('Error parsing JSON response:', jsonError);
                return [];
            }
        } catch (error) {
            console.error('Error fetching routes:', error);
            return [];
        }
    },

    async findRoute(fromIata, toIata) {
        try {
            if (!fromIata || !toIata) {
                return null;
            }
            
            const routes = await this.fetchAndCacheRoutes(fromIata);
            if (!routes || !Array.isArray(routes)) {
                console.warn(`No routes found for ${fromIata} or invalid response`);
                return null;
            }
            
            return routes.find(route => route.destination === toIata);
        } catch (error) {
            console.error(`Error finding route from ${fromIata} to ${toIata}:`, error);
            return null;
        }
    },

    shouldDisplayAirport(airportWeight, currentZoom, isSelectedRoute = false) {
        if (isSelectedRoute) {
            return true;
        }
        return airportWeight <= currentZoom - 1;
    },

    updateVisibleMarkers() {
        // Check if map movement is prevented (e.g. when viewing a selected route)
        if (appState.preventMapMovement) {
            return;
        }
        
        // Cache current bounds and zoom to avoid repeated calls to map methods
        const currentZoom = map.getZoom();
        const currentBounds = map.getBounds();
        // Store original map center and zoom level to restore after updates
        const originalCenter = map.getCenter();
        const originalZoom = currentZoom;

        // Process airport data based on current view
        Object.values(this.airportDataCache).forEach(airport => {
            const isSelectedRoute = appState.selectedRoute?.includes(airport.iata_code);
            if (this.shouldDisplayAirport(airport.weight, currentZoom, isSelectedRoute) &&
                currentBounds.contains(L.latLng(airport.latitude, airport.longitude)) &&
                !this.markers[airport.iata_code]) {
                this.addMarker(airport);
                if (this.markers[airport.iata_code]) {
                    this.markers[airport.iata_code].addTo(map);
                }
            }
        });

        // Update marker visibility based on current view
        Object.keys(this.markers).forEach(iata => {
            const marker = this.markers[iata];
            
            // Check if this iata is in any valid route as origin or destination using routeData
            const isInRoute = appState.routeData.some(route => 
                route && !route.isEmpty && (
                    (route.origin && route.origin.iata_code === iata) || 
                    (route.destination && route.destination.iata_code === iata)
                )
            );
            
            const isSelectedRoute = appState.selectedRoute?.includes(iata);
            
            // Only update marker visibility without changing map view
            if (isInRoute || this.shouldDisplayAirport(marker.airportWeight, currentZoom, isSelectedRoute)) {
                if (currentBounds.contains(marker.getLatLng())) {
                    if (!map.hasLayer(marker)) {
                        marker.addTo(map);
                    }
                } else if (!isInRoute) {
                    map.removeLayer(marker);
                }
            }
        });
        
        // Restore original map view if it was changed
        if (!originalCenter.equals(map.getCenter()) || originalZoom !== map.getZoom()) {
            map.setView(originalCenter, originalZoom, { animate: false });
        }
    },

    clearRouteCache() {
        // Clear all route-related cache items
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i);
            if (key.startsWith('routes_')) {
                localStorage.removeItem(key);
            }
        }
        console.info('Route cache cleared');
    }
};

export { flightMap };
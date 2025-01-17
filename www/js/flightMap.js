import { map, blueDotIcon, magentaDotIcon, greenDotIcon } from './map.js';
import { pathDrawing } from './pathDrawing.js';
import { eventManager } from './eventManager.js';
import { appState, updateState } from './stateManager.js';
import { lineManager } from './lineManager.js';

const flightMap = {
    markers: {},
    airportDataCache: {},
    cacheDuration: 3600000, // Increase from 10 minutes to 1 hour
    hoverDisabled: false, // Add this flag
    preservedMarker: null,  // Add tracking for preserved marker
    hoverTimeout: null, // Add hoverTimeout to debounce hover events

    init() {
        if (typeof map !== 'undefined') {
            this.getAirportDataByIata = this.getAirportDataByIata.bind(this);
            this.updateVisibleMarkers = this.updateVisibleMarkers.bind(this);

            map.on('zoomend', this.updateVisibleMarkers);
            map.on('moveend', this.updateVisibleMarkers);

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
        return appState.waypoints.some(wp => wp.iata_code === iata) ? magentaDotIcon : blueDotIcon;
    },

    handleMarkerClick(airport, clickedMarker) {
        Object.values(this.markers).forEach(marker => marker.closePopup());
        this.preservedMarker = clickedMarker;
        this.hoverDisabled = true;
        updateState('selectedAirport', airport);

        const popupContent = document.createElement('div');
        const cityName = document.createElement('p');
        cityName.textContent = airport.city;
        popupContent.appendChild(cityName);

        const waypointIndex = appState.waypoints.findIndex(wp => wp.iata_code === airport.iata_code);
        const button = document.createElement('button');
        button.className = 'tooltip-button';
        button.textContent = waypointIndex === -1 ? '+' : '-';

        button.addEventListener('click', () => {
            const currentWaypointIndex = appState.waypoints.findIndex(wp => wp.iata_code === airport.iata_code);
            if (currentWaypointIndex === -1) {
                const lastWaypoint = appState.waypoints[appState.waypoints.length - 1];
                if (appState.waypoints.length >= 2 && appState.waypoints.length % 2 === 0) {
                    updateState('addWaypoint', lastWaypoint);
                    updateState('addWaypoint', airport);
                } else {
                    updateState('addWaypoint', airport);
                }
                clickedMarker.setIcon(magentaDotIcon);
                button.textContent = '-';
            } else {
                if (currentWaypointIndex === appState.waypoints.length - 1 && currentWaypointIndex > 1) {
                    updateState('removeWaypoint', currentWaypointIndex);
                    updateState('removeWaypoint', currentWaypointIndex - 1);
                } else {
                    updateState('removeWaypoint', currentWaypointIndex + 1);
                    updateState('removeWaypoint', currentWaypointIndex);
                }
                lineManager.clearLines('hover');
                clickedMarker.setIcon(blueDotIcon);
                this.hoverDisabled = false;
                button.textContent = '+';
            }
            updateState('selectedAirport', null);
        });

        popupContent.appendChild(button);
        clickedMarker.bindPopup(popupContent, { autoClose: false, closeOnClick: true }).openPopup();

        // Move line drawing after popup is bound
        this.fetchAndCacheRoutes(airport.iata_code).then(() => {
            if (!appState.directRoutes[airport.iata_code]) {
                console.error('Direct routes not found for IATA:', airport.iata_code);
                return;
            }
            lineManager.clearLines('hover');
            pathDrawing.drawRoutePaths(airport.iata_code, appState.directRoutes, 'hover');
            clickedMarker.openPopup(); // Re-open popup after drawing lines
        });
    },

    findRoute(fromIata, toIata) {
        try {
            for (const routes of Object.values(appState.directRoutes)) {
                for (const route of routes) {
                    if (route.originAirport.iata_code === fromIata && route.destinationAirport.iata_code === toIata) {
                        return route;
                    }
                }
            }
        } catch (error) {
            console.error(`Error finding route from ${fromIata} to ${toIata}:`, error);
        }
        return null;
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
            console.info('Airport data loaded from localStorage');
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
    
            console.info('Airport data fetched from API and cached');
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
        // Skip hover effects if there's a preserved marker and this isn't it
        if (this.preservedMarker && this.markers[iata] !== this.preservedMarker) {
            return;
        }

        const marker = this.markers[iata];
        if (!marker) return;
        const airport = this.airportDataCache[iata];
        if (!airport) return;

        clearTimeout(this.hoverTimeout); // Clear any existing hover timeout

        if (event === 'mouseover') {
                this.fetchAndCacheRoutes(iata).then(() => {
                    if (!appState.directRoutes[iata]) {
                        console.error('Direct routes not found for IATA:', iata);
                        return;
                    }
                    // Clear existing hover lines before drawing new ones
                    lineManager.clearLines('hover');
                    // Only draw hover paths if no marker is preserved
                    if (!this.preservedMarker) {
                        pathDrawing.drawRoutePaths(iata, appState.directRoutes, 'hover');
                    }
                    marker.openPopup();
                    marker.hovered = true;
                });
        } else if (event === 'mouseout' && !this.preservedMarker) {
            this.hoverTimeout = setTimeout(() => {
                lineManager.clearLines('hover');
                marker.closePopup();
            }, 200);
        }

        if (appState.selectedAirport && appState.selectedAirport.iata_code === iata) {
            marker.openPopup();
        }
    },

    async fetchAndCacheRoutes(iata) {
        if (!iata) {
            console.error('IATA code is empty');
            return;
        }
    
        const cacheKey = `routes_${iata}_${appState.routeDirection}`;
        const cachedData = localStorage.getItem(cacheKey);
    
        if (cachedData && (Date.now() - JSON.parse(cachedData).timestamp < this.cacheDuration)) {
            appState.directRoutes[iata] = JSON.parse(cachedData).data;
            console.info('Route data loaded from localStorage');
            return;
        }
    
        try {
            const direction = appState.routeDirection;
            const response = await fetch(`https://yonderhop.com/api/directRoutes?origin=${iata}&direction=${direction}`);
            const routes = await response.json();
            if (!routes || !routes.length) {
                console.error('No routes found for IATA:', iata);
                return;
            }
    
            // Store the routes in localStorage with a timestamp
            localStorage.setItem(cacheKey, JSON.stringify({ data: routes, timestamp: Date.now() })); 
            appState.directRoutes[iata] = routes;
    
            console.info('Route data fetched from API and cached');
        } catch (error) {
            console.error('Error fetching routes:', error);
        }
    },

    shouldDisplayAirport(airportWeight, currentZoom) {
        return airportWeight <= currentZoom - 1;
    },

    updateVisibleMarkers() {
        const currentZoom = map.getZoom();
        const currentBounds = map.getBounds();

        Object.values(this.airportDataCache).forEach(airport => {
            if (this.shouldDisplayAirport(airport.weight, currentZoom) &&
                currentBounds.contains(L.latLng(airport.latitude, airport.longitude)) &&
                !this.markers[airport.iata_code]) {
                this.addMarker(airport);
                if (this.markers[airport.iata_code]) {
                    this.markers[airport.iata_code].addTo(map);
                }
            }
        });

        Object.keys(this.markers).forEach(iata => {
            const marker = this.markers[iata];
            const isWaypoint = appState.waypoints.some(wp => wp.iata_code === iata);
            if (isWaypoint || this.shouldDisplayAirport(marker.airportWeight, currentZoom)) {
                if (currentBounds.contains(marker.getLatLng())) {
                    if (!map.hasLayer(marker)) {
                        marker.addTo(map);
                    }
                } else if (!isWaypoint) {
                    map.removeLayer(marker);
                }
            } else if (!isWaypoint) {
                map.removeLayer(marker);
            }
        });
    }
};

export { flightMap };
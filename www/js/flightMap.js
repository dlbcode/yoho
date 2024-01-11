import { map, blueDotIcon, magentaDotIcon } from './map.js';
import { pathDrawing } from './pathDrawing.js';
import { eventManager } from './eventManager.js';
import { appState, updateState } from './stateManager.js';

const flightMap = {
    markers: {},
    directRoutes: {},
    currentLines: [],
    selectedMarker: null,
    toggleState: 'from',
    routePathCache: {},
    clearMultiHopPaths: true,
    cachedRoutes: [],
    lastFetchTime: null,
    cacheDuration: 600000, // 10 minutes in milliseconds
        
    processRouteData(data) {
        const uniqueAirports = new Set();
    
        data.forEach(route => {
            if (!route.originAirport || !route.destinationAirport) {
                console.info('Incomplete route data:', route);
                return;
            }
    
            // Check if the origin airport has already been added
            if (!uniqueAirports.has(route.originAirport.iata_code)) {
                this.addMarker(route.originAirport);
                uniqueAirports.add(route.originAirport.iata_code);
            }
    
            // Check if the destination airport has already been added
            if (!uniqueAirports.has(route.destinationAirport.iata_code)) {
                this.addMarker(route.destinationAirport);
                uniqueAirports.add(route.destinationAirport.iata_code);
            }
    
            let destIata = route.destinationAirport.iata_code;
            this.directRoutes[destIata] = this.directRoutes[destIata] || [];
            this.directRoutes[destIata].push(route);
        });
    },    

    addMarker(airport) {
        if (!airport || !airport.iata_code || !airport.weight) {
            console.error('Incomplete airport data:', airport);
            return;
        }
    
        let iata = airport.iata_code;
        if (this.markers[iata]) return;
    
        let icon = appState.waypoints.some(wp => wp.iata_code === iata) ? magentaDotIcon : blueDotIcon;
    
        if (airport.weight <= map.getZoom()) {
            const latLng = L.latLng(airport.latitude, airport.longitude);
            const marker = L.marker(latLng, {icon: icon}).addTo(map);
    
            // Bind a popup with the airport name
            marker.bindPopup(`<b>${airport.city}</b>`, { maxWidth: 'auto' });
    
            // Add event listeners for mouseover and mouseout
            marker.on('mouseover', function(e) {
                this.openPopup();
            });
            marker.on('mouseout', function(e) {
                this.closePopup();
            });
    
            eventManager.attachMarkerEventListeners(iata, marker, airport);
            this.markers[iata] = marker;
        }
    },    

    handleMarkerClick(airport, clickedMarker) {
        const lastWaypoint = appState.waypoints[appState.waypoints.length - 1];
    
        if (lastWaypoint && lastWaypoint.iata_code !== airport.iata_code) {
            const directRoute = this.findRoute(lastWaypoint.iata_code, airport.iata_code);
            if (!directRoute) {
                // No direct route, find the cheapest route
                updateState('addWaypoint', airport);
            } else {
                // Direct route exists, add the clicked airport as a waypoint
                updateState('addWaypoint', airport);
            }
        } else if (lastWaypoint && lastWaypoint.iata_code === airport.iata_code) {
            // Remove the last waypoint if the same airport is clicked again
            updateState('removeWaypoint', appState.waypoints.length - 1);
            clickedMarker.setIcon(blueDotIcon);
        } else {
            // If there is no last waypoint, simply add the clicked airport
            updateState('addWaypoint', airport);
            clickedMarker.setIcon(magentaDotIcon);
        }
    
        clickedMarker.selected = !clickedMarker.selected;
    },       

    findRoute(fromIata, toIata) {
        for (const routes of Object.values(this.directRoutes)) {
            for (const route of routes) {
                if (route.originAirport.iata_code === fromIata && route.destinationAirport.iata_code === toIata) {
                    return route;
                }
            }
        }
        return null;
    },      

    fetchAndCacheAirports() {
        if (this.airportDataCache) {
            return Promise.resolve(this.airportDataCache);
        }

        return fetch('http://yonderhop.com:3000/airports')
            .then(response => response.json())
            .then(data => {
                this.airportDataCache = data.reduce((acc, airport) => {
                    acc[airport.iata_code] = airport;
                    return acc;
                }, {});
                return this.airportDataCache;
            });
    },

    getAirportDataByIata(iata) {
        if (this.airportDataCache && this.airportDataCache[iata]) {
            return Promise.resolve(this.airportDataCache[iata]);
        }

        return this.fetchAndCacheAirports().then(cache => cache[iata] || null);
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
            var newLatLng = pathDrawing.adjustLatLng(marker.getLatLng());
            marker.setLatLng(newLatLng);
        });
    },

    markerHoverHandler(iata, event) {
        if (this.selectedMarker !== iata) {
            if (event === 'mouseover') {
                this.fetchAndCacheRoutes(iata).then(() => {
                    pathDrawing.drawRoutePaths(iata, this.directRoutes, this.toggleState);
                });
            } else if (event === 'mouseout') {
                pathDrawing.clearLines();
                pathDrawing.drawLines();
            }
        }
    },
    
    async fetchAndCacheRoutes(iata) {
        if (!this.directRoutes[iata]) {
            try {
                const response = await fetch(`http://yonderhop.com:3000/directRoutes?origin=${iata}`);
                const routes = await response.json();
                this.directRoutes[iata] = routes;
            } catch (error) {
                console.error('Error fetching routes:', error);
            }
        }
    },
    
    async fetchAndDisplayAirports() {
        try {
            const airports = await this.fetchAndCacheAirports();
            Object.values(airports).forEach(airport => {
                this.addMarker(airport);
            });
        } catch (error) {
            console.error('Error fetching airports:', error);
        }
    },

    updateMarkersForZoom() {
        Object.values(this.markers).forEach(marker => {
            map.removeLayer(marker);
        });
        this.markers = {};
        //this.plotRoutePaths();
    },

    updateVisibleMarkers() {
        Object.keys(this.markers).forEach(iata => {
            const marker = this.markers[iata];
            if (!map.getBounds().contains(marker.getLatLng())) {
                map.removeLayer(marker);
                delete this.markers[iata];
            }
        });

        // Fetch and display airports if needed
        this.fetchAndDisplayAirports();
    },
};

export { flightMap };

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
    cacheDuration: 60000, // 1 minute in milliseconds

    async plotRoutePaths() {
        return new Promise((resolve, reject) => {
            const currentTime = new Date().getTime();
            // Check if cached data is available and still valid
            if (this.cachedRoutes && this.lastFetchTime && currentTime - this.lastFetchTime < this.cacheDuration) {
                this.processRouteData(this.cachedRoutes);
                resolve(); // Resolve the promise as data is already processed
            } else {
                // Fetch new data as cache is empty or outdated
                fetch('http://yonderhop.com:3000/directRoutes')
                    .then(response => response.json())
                    .then(data => {
                        this.cachedRoutes = data;
                        this.lastFetchTime = currentTime;
                        this.processRouteData(data);
                        resolve(); // Resolve the promise after processing is complete
                    })
                    .catch(error => {
                        console.error('Error:', error);
                        reject(error); // Reject the promise on error
                    });
            }
        });
    },    
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
                clickedMarker.setIcon(magentaDotIcon);
            } else {
                // Direct route exists, add the clicked airport as a waypoint
                updateState('addWaypoint', airport);
                clickedMarker.setIcon(magentaDotIcon);
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

    async handleNoDirectRoute(originIata, destinationIata) {
        const originAirport = await this.getAirportDataByIata(originIata);
        const destinationAirport = await this.getAirportDataByIata(destinationIata);
    
        if (originAirport && destinationAirport) {
            pathDrawing.drawDashedLine(originAirport, destinationAirport);
        } else {
            console.error('Airport data not found for one or both IATAs:', originIata, destinationIata);
        }
    },

    async findCheapestRouteAndAddWaypoints(originIata, destinationIata) {
        try {
            const response = await fetch(`http://yonderhop.com:3000/cheapest-routes?origin=${originIata}&destination=${destinationIata}`);
            const cheapestRoutes = await response.json();
    
            if (cheapestRoutes && cheapestRoutes.length > 0) {
                // Start from index 1 if the first waypoint is the same as the last selected waypoint
                const startIndex = (cheapestRoutes[0].route[0] === originIata) ? 1 : 0;
    
                for (let i = startIndex; i < cheapestRoutes[0].route.length; i++) {
                    const iataCode = cheapestRoutes[0].route[i];
                    const airportData = await flightMap.getAirportDataByIata(iataCode);
                    updateState('addWaypoint', airportData);
                }
            }
        } catch (error) {
            console.error('Error fetching cheapest routes:', error);
        }
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
                pathDrawing.drawRoutePaths(iata, this.directRoutes, this.toggleState);
            } else if (event === 'mouseout') {
                pathDrawing.clearLines();
                pathDrawing.drawLines();
            }
        }
    },

    updateMarkersForZoom() {
        Object.values(this.markers).forEach(marker => {
            map.removeLayer(marker);
        });
        this.markers = {};
        this.plotRoutePaths();
    },

    updateVisibleMarkers() {
        Object.keys(this.markers).forEach(iata => {
            const marker = this.markers[iata];
            if (!map.getBounds().contains(marker.getLatLng())) {
                map.removeLayer(marker);
                delete this.markers[iata];
            }
        });

        Object.values(this.directRoutes).forEach(routes => {
            routes.forEach(route => {
                if (route.originAirport) {
                    this.addMarker(route.originAirport);
                }
                if (route.destinationAirport) {
                    this.addMarker(route.destinationAirport);
                }
            });
        });
    }
};

export { flightMap };

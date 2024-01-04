import { map, blueDotIcon, magentaDotIcon } from './map.js';
import { pathDrawing } from './pathDrawing.js';
import { flightList } from './flightList.js';
import { eventManager } from './eventManager.js';
import { appState, updateState } from './stateManager.js';

const flightMap = {
    markers: {},
    directFlights: {},
    currentLines: [],
    selectedMarker: null,
    toggleState: 'from',
    flightPathCache: {},
    clearMultiHopPaths: true,
    cachedFlights: null,
    lastFetchTime: null,
    cacheDuration: 60000, // 1 minute in milliseconds

    async plotFlightPaths() {
        return new Promise((resolve, reject) => {
            const currentTime = new Date().getTime();
            if (this.cachedFlights && this.lastFetchTime && currentTime - this.lastFetchTime < this.cacheDuration) {
                this.processFlightData(this.cachedFlights);
            } else {
                fetch('http://yonderhop.com:3000/flights')
                    .then(response => response.json())
                    .then(data => {
                        this.cachedFlights = data;
                        this.lastFetchTime = currentTime;
                        this.processFlightData(data);
                    })
                    .catch(error => console.error('Error:', error));
            }
            fetch('http://yonderhop.com:3000/flights')
            .then(response => response.json())
            .then(data => {
                this.cachedFlights = data;
                this.lastFetchTime = new Date().getTime();
                this.processFlightData(data);
                resolve(); // Resolve the promise after processing is complete
            })
            .catch(error => {
                console.error('Error:', error);
                reject(error); // Reject the promise on error
            });
        });
    },

    processFlightData(data) {
        const uniqueAirports = new Set();
    
        data.forEach(flight => {
            if (!flight.originAirport || !flight.destinationAirport) {
                console.info('Incomplete flight data:', flight);
                return;
            }
    
            // Check if the origin airport has already been added
            if (!uniqueAirports.has(flight.originAirport.iata_code)) {
                this.addMarker(flight.originAirport);
                uniqueAirports.add(flight.originAirport.iata_code);
            }
    
            // Check if the destination airport has already been added
            if (!uniqueAirports.has(flight.destinationAirport.iata_code)) {
                this.addMarker(flight.destinationAirport);
                uniqueAirports.add(flight.destinationAirport.iata_code);
            }
    
            let destIata = flight.destinationAirport.iata_code;
            this.directFlights[destIata] = this.directFlights[destIata] || [];
            this.directFlights[destIata].push(flight);
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
        console.log('lastWaypoint:', lastWaypoint);
        if (lastWaypoint && lastWaypoint.iata_code === airport.iata_code) {
            updateState('removeWaypoint', appState.waypoints.length - 1);
            clickedMarker.setIcon(blueDotIcon);
        } else {
            updateState('addWaypoint', airport);
            clickedMarker.setIcon(magentaDotIcon);
            updateState('selectedAirport', airport.iata_code);
        }
    
        clickedMarker.selected = !clickedMarker.selected;
    },    

    findFlight(fromIata, toIata) {
        for (const flights of Object.values(this.directFlights)) {
            for (const flight of flights) {
                if (flight.originAirport.iata_code === fromIata && flight.destinationAirport.iata_code === toIata) {
                    return flight;
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
                pathDrawing.drawFlightPaths(iata, this.directFlights, this.toggleState);
            } else if (event === 'mouseout') {
                pathDrawing.clearFlightPaths();
            }
        }
    },

    updateMarkersForZoom() {
        Object.values(this.markers).forEach(marker => {
            map.removeLayer(marker);
        });
        this.markers = {};
        this.plotFlightPaths();
    },

    updateVisibleMarkers() {
        Object.keys(this.markers).forEach(iata => {
            const marker = this.markers[iata];
            if (!map.getBounds().contains(marker.getLatLng())) {
                map.removeLayer(marker);
                delete this.markers[iata];
            }
        });

        Object.values(this.directFlights).forEach(flights => {
            flights.forEach(flight => {
                if (flight.originAirport) {
                    this.addMarker(flight.originAirport);
                }
                if (flight.destinationAirport) {
                    this.addMarker(flight.destinationAirport);
                }
            });
        });
    }
};

export { flightMap };

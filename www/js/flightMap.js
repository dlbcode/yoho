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

    plotFlightPaths() {
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

        if (airport.weight <= map.getZoom()) {
            const latLng = L.latLng(airport.latitude, airport.longitude);
            const marker = L.marker(latLng, {icon: blueDotIcon}).addTo(map)
            .bindPopup(`<b>${airport.name}</b><br>${airport.city}, ${airport.country}`);

            // Use eventManager to attach event listeners to markers
            eventManager.attachMarkerEventListeners(iata, marker, airport);
            this.markers[iata] = marker;
        }
    },

    handleMarkerClick(airport, clickedMarker) {
        const airportInfo = `${airport.city} (${airport.iata_code})`;
        const toggleState = appState.flightPathToggle;
        const fromAirportElem = document.getElementById('fromAirport');
        const toAirportElem = document.getElementById('toAirport');
    
        // Check if the marker is already selected
        if (clickedMarker.selected) {
            // Remove the airport from waypoints if it's already selected
            updateState('removeWaypoint', airport.iata_code);
            clickedMarker.setIcon(blueDotIcon);
            clickedMarker.selected = false;
        } else {
            // Add the airport to waypoints if it's not selected
            updateState('addWaypoint', airport);
            clickedMarker.setIcon(magentaDotIcon);
            clickedMarker.selected = true;
    
            if (toggleState === 'from') {
                // Update appState.selectedAirport and populate fromAirport element
                updateState('selectedAirport', airport.iata_code);
                fromAirportElem.value = airportInfo;
                updateState('fromAirport', airport.iata_code);
                appState.flightPathToggle = 'to';
            } else if (toggleState === 'to') {
                toAirportElem.value = airportInfo;
                updateState('toAirport', airport.iata_code);
                appState.flightPathToggle = 'from';
            }
    
            console.table(appState.waypoints);
    
            if (fromAirportElem.value !== '' && toAirportElem.value !== '') {
                this.findAndAddFlightToList(appState.fromAirport, appState.toAirport);
            }
        }
    },

    findAndAddFlightToList(fromAirport, toAirport) {
        console.log('findAndAddFlightToList fromAirport:', fromAirport, 'toAirport:', toAirport);
        console.log('appState.fromAirport:' + appState.fromAirport, 'appState.toAirport:', appState.toAirport);
        const fromIata = fromAirport.iata_code;
        const toIata = toAirport.iata_code;
        const flight = this.findFlight(fromIata, toIata);
        if (flight) {
            flightList.addFlightDetailsToList(flight, pathDrawing.clearFlightPaths.bind(this));
        }
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
            return 'grey'; // Return grey for flights without price data
        }
        price = parseFloat(price);
        return price < 100 ? '#0099ff' : price < 200 ? 'green' : price < 300 ? '#abb740' : price < 400 ? 'orange' : price < 500 ? '#da4500' : '#c32929';
    },

    redrawMarkers() {
        Object.values(this.markers).forEach(marker => {
            var newLatLng = this.adjustLatLng(marker.getLatLng());
            marker.setLatLng(newLatLng);
        });
    },

    adjustLatLng(latLng) {
        var currentBounds = map.getBounds();
        var newLng = latLng.lng;

        while (newLng < currentBounds.getWest()) newLng += 360;
        while (newLng > currentBounds.getEast()) newLng -= 360;

        return L.latLng(latLng.lat, newLng);
    },

    markerHoverHandler(iata, event) {
        if (this.selectedMarker !== iata) {
            pathDrawing.clearFlightPaths();
            if (event === 'mouseover') {
                pathDrawing.drawFlightPaths(iata, this.directFlights, this.toggleState);
            } else if (this.selectedMarker) {
                pathDrawing.drawFlightPaths(this.selectedMarker, this.directFlights, this.toggleState);
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
    },

    drawFlightPathBetweenAirports(route) {
        pathDrawing.clearFlightPaths();
        try {
            if (!route || !Array.isArray(route.segmentCosts)) {
                console.error('Invalid route data:', route);
                return;
            }

            const airportPromises = route.segmentCosts.map(segment => {
                return Promise.all([this.getAirportDataByIata(segment.from), this.getAirportDataByIata(segment.to)]);
            });

            Promise.all(airportPromises).then(airportPairs => {
                airportPairs.forEach(([originAirport, destinationAirport], index) => {
                    if (originAirport && destinationAirport) {
                        const flightSegment = {
                            originAirport: originAirport,
                            destinationAirport: destinationAirport,
                            price: route.segmentCosts[index].price
                        };

                        pathDrawing.createFlightPath(originAirport, destinationAirport, flightSegment, 0);
                        flightList.addFlightDetailsToList(flightSegment, pathDrawing.clearFlightPaths.bind(this));
                    }
                });
            }).catch(error => {
                console.error('Error in drawFlightPathBetweenAirports:', error);
            });
        } catch (error) {
            console.error('Error in drawFlightPathBetweenAirports:', error);
        }
    }
};

export { flightMap };

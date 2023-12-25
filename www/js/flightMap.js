import { map, blueDotIcon, magentaDotIcon } from './map.js';
import { pathDrawing } from './pathDrawing.js';
import { flightList } from './flightList.js';
import { emitCustomEvent } from './eventListeners.js';

const flightMap = {
    markers: {},
    flightsByDestination: {},
    currentLines: [],
    selectedMarker: null,
    toggleState: 'from',
    flightPathCache: {},
    clearMultiHopPaths: true,

    // New properties for caching
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
        data.forEach(flight => {
            if (!flight.originAirport || !flight.destinationAirport) {
                console.info('Incomplete flight data:', flight);
                return;
            }

            this.addMarker(flight.originAirport);
            this.addMarker(flight.destinationAirport);

            let destIata = flight.destinationAirport.iata_code;
            this.flightsByDestination[destIata] = this.flightsByDestination[destIata] || [];
            this.flightsByDestination[destIata].push(flight);
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

            emitCustomEvent('markerCreated', { iata, marker, airport }); // Include the airport data
            this.markers[iata] = marker;
        }
    },

    // Exposed methods for eventListeners.js
    handleMarkerClick(airport, clickedMarker) {
        const airportInfo = `${airport.city} (${airport.iata_code})`;
        console.log('handleMarkerClick airportInfo:', airportInfo, 'toggleState:', this.toggleState);
        const toggleState = document.getElementById('flightPathToggle').value;
        const fromAirportElem = document.getElementById('fromAirport');
        const toAirportElem = document.getElementById('toAirport');

        clickedMarker.setIcon(magentaDotIcon);
        this.selectedMarker = airport.iata_code;

        if ((toggleState === 'from' && fromAirportElem.value !== '') || 
            (toggleState === 'to' && toAirportElem.value !== '')) {
            this.findAndAddFlightToList(
                toggleState === 'from' ? fromAirportElem.value : airportInfo, 
                toggleState === 'from' ? airportInfo : toAirportElem.value
            );

            fromAirportElem.value = airportInfo;
            toAirportElem.value = '';
        } else {
            if (toggleState === 'from') {
                fromAirportElem.value = airportInfo;
            } else {
                toAirportElem.value = airportInfo;
            }
        }
        console.log('handleMarkerClick fromAirportElem:', fromAirportElem.value);
    },

    findAndAddFlightToList(fromAirport, toAirport) {
        const fromIata = fromAirport.split('(')[1].slice(0, -1);
        const toIata = toAirport.split('(')[1].slice(0, -1);
        const flight = this.findFlight(fromIata, toIata);
        if (flight) {
            flightList.addFlightDetailsToList(flight, pathDrawing.clearFlightPaths.bind(this));
        }
    },

    findFlight(fromIata, toIata) {
        for (const flights of Object.values(this.flightsByDestination)) {
            for (const flight of flights) {
                if (flight.originAirport.iata_code === fromIata && flight.destinationAirport.iata_code === toIata) {
                    return flight;
                }
            }
        }
        return null;
    },

    airportDataCache: null,

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
                pathDrawing.drawFlightPaths(iata, this.flightsByDestination, this.toggleState);
            } else if (this.selectedMarker) {
                pathDrawing.drawFlightPaths(this.selectedMarker, this.flightsByDestination, this.toggleState);
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

        Object.values(this.flightsByDestination).forEach(flights => {
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
};

export { flightMap };

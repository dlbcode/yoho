import { map } from './mapInit.js';
import { blueDotIcon } from './markers.js';
import { flightList } from './flightList.js';
import { emitCustomEvent } from './eventListeners.js'; // Added for emitting custom events

const flightMap = {
    markers: {},
    flightsByDestination: {},
    currentLines: [],
    selectedMarker: null,
    toggleState: 'to',
    flightPathCache: {},

    drawFlightPaths(iata) {
        this.clearFlightPaths(); // Clear existing paths from the map
    
        let cacheKey = this.toggleState + '_' + iata; // Include toggleState in cacheKey
    
        if (this.flightPathCache[cacheKey]) {
            // Re-add cached paths to the map and update currentLines
            this.flightPathCache[cacheKey].forEach(path => {
                if (!map.hasLayer(path)) {
                    path.addTo(map);
                }
                if (!this.currentLines.includes(path)) {
                    this.currentLines.push(path);
                }
            });
        } else {
            // Draw new paths and cache them
            this.toggleState === 'to' ? this.drawFlightPathsToDestination(iata) : this.drawFlightPathsFromOrigin(iata);
        }
    },

    drawFlightPathsFromOrigin(originIata) {
        Object.values(this.flightsByDestination).forEach(flights =>
            flights.forEach(flight => {
                if (flight.originAirport.iata_code === originIata) {
                    this.drawPaths(flight, originIata);
                }
            })
        );
    },

    plotFlightPaths() {
        fetch('http://localhost:3000/flights')
            .then(response => response.json())
            .then(data => {
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
            })
            .catch(error => console.error('Error:', error));
    },


    addMarker(airport) {
        if (!airport || !airport.iata_code || !airport.weight) {
            console.error('Incomplete airport data:', airport);
            return;
        }

        let iata = airport.iata_code;
        if (this.markers[iata]) return;

        // Check if the airport's weight is less than or equal to the current zoom level
        if (airport.weight <= map.getZoom()) {
            const latLng = L.latLng(airport.latitude, airport.longitude);
            const marker = L.marker(latLng, {icon: blueDotIcon}).addTo(map)
                .bindPopup(`<b>${airport.name}</b><br>${airport.city}, ${airport.country}`);

            // Emit custom events for marker interactions
            emitCustomEvent('markerCreated', { iata, marker });

            this.markers[iata] = marker;
        }
    },


    drawFlightPathsToDestination(destinationIata) {
        const destinationFlights = this.flightsByDestination[destinationIata] || [];
        destinationFlights.forEach(flight => this.drawPaths(flight, destinationIata));
    },

    createFlightPath(origin, destination, flight, lngOffset) {
        var adjustedOrigin = [origin.latitude, origin.longitude + lngOffset];
        var adjustedDestination = [destination.latitude, destination.longitude + lngOffset];
    
        var geodesicLine = new L.Geodesic([adjustedOrigin, adjustedDestination], {
            weight: 6,
            opacity: .7,
            color: this.getColorBasedOnPrice(flight.price),
            wrap: false
        }).addTo(map);
    
        geodesicLine.flight = flight; // Attach flight data to the line
    
        // Event listener for path click
        geodesicLine.on('click', () => {
            if (flightList.isFlightListed(flight)) {
                flightList.removeFlightFromList(flight);
                this.clearFlightPaths();
            } else {
                flightList.addFlightDetailsToList(flight, this.clearFlightPaths.bind(this));
            }
        });
    
        // Attach event listeners to the geodesic line
        geodesicLine.on('mouseover', (e) => {
            L.popup()
                .setLatLng(e.latlng)
                .setContent(`Price: $${flight.price}`)
                .openOn(map);
        });
    
        geodesicLine.on('mouseout', () => {
            map.closePopup();
        });
    
        var directionSymbol = L.Symbol.arrowHead({
            pixelSize: 5,
            polygon: false,
            pathOptions: {
                stroke: true,
                color: '#fff',
                opacity: .7,
                weight: 2
            }
        });
        
        var decoratedLine = L.polylineDecorator(geodesicLine, {
            patterns: [
                {offset: '25px', repeat: '50px', symbol: directionSymbol}
            ]
        }).addTo(map);
    
        // Store both the geodesic line and the decorated line
        this.currentLines.push(geodesicLine, decoratedLine);

        // Cache the created flight paths
        let destinationIata = flight.destinationAirport.iata_code;
        let originIata = flight.originAirport.iata_code;
        let cacheKey = this.toggleState + '_' + (this.toggleState === 'to' ? destinationIata : originIata);

        this.flightPathCache[cacheKey] = this.flightPathCache[cacheKey] || [];
        this.flightPathCache[cacheKey].push(geodesicLine, decoratedLine);

        // Attach event listeners to the decorated line
        decoratedLine.on('mouseover', (e) => {
            L.popup()
                .setLatLng(e.latlng)
                .setContent(`Price: $${flight.price}`)
                .openOn(map);
        });
    
        decoratedLine.on('mouseout', () => {
            map.closePopup();
        });
    
        decoratedLine.on('click', () => {
            this.addFlightDetailsToList(flight, this.clearFlightPaths.bind(this));
        });

        geodesicLine.flight = flight;
        decoratedLine.flight = flight;

        return decoratedLine;
    },

    clearFlightPaths(exceptIata = null) {
        this.currentLines = this.currentLines.filter(line => {
            if (flightList.isFlightListed(line.flight)) {
                return true;
            } else {
                if (map.hasLayer(line)) {
                    map.removeLayer(line);
                }
                return false;
            }
        });

        if (exceptIata) {
            this.drawFlightPaths(exceptIata);
        }
    },

    getColorBasedOnPrice(price) {
        if (price === null || price === undefined || isNaN(parseFloat(price))) {
            return 'grey'; // Return grey for flights without price data
        }
        price = parseFloat(price);
        return price < 100 ? '#0099ff' : price < 200 ? 'green' : price < 300 ? '#abb740': price <400 ? 'orange' : price < 500 ? 'amber' : '#c32929';
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

    drawPaths(flight, iata) {
        this.createFlightPath(flight.originAirport, flight.destinationAirport, flight, 0);
        for (let offset = -720; offset <= 720; offset += 360) {
            if (offset !== 0) {
                this.createFlightPath(flight.originAirport, flight.destinationAirport, flight, offset);
            }
        }
    },

    markerClickHandler(iata) {
        if (this.selectedMarker) {
            this.clearFlightPaths(this.selectedMarker);
        }
        this.clearFlightPaths();
        this.selectedMarker = iata;
        this.drawFlightPaths(iata);
    },

    markerHoverHandler(iata, event) {
        if (this.selectedMarker !== iata) {
            this.clearFlightPaths();
            if (event === 'mouseover') {
                this.drawFlightPaths(iata);
            } else if (this.selectedMarker) {
                this.drawFlightPaths(this.selectedMarker);
            }
        }
    },

    updateMarkersForZoom() {
        Object.values(this.markers).forEach(marker => {
            map.removeLayer(marker);
        });
        this.markers = {};
        // Re-fetch and re-plot the airports based on the new zoom level
        this.plotFlightPaths();
    },

    updateVisibleMarkers() {
        // Remove markers that are no longer in view
        Object.keys(this.markers).forEach(iata => {
            const marker = this.markers[iata];
            if (!map.getBounds().contains(marker.getLatLng())) {
                map.removeLayer(marker);
                delete this.markers[iata];
            }
        });

        // Add markers for airports that are now in view
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

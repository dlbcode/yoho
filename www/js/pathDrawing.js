import { map } from './map.js';
import { flightList } from './flightList.js';
import { updateState, appState } from './stateManager.js';

const pathDrawing = {
    currentLines: [],
    flightPathCache: {},

    drawFlightPaths(iata, directFlights) {
        let cacheKey = appState.flightPathToggle + '_' + iata;
        if (this.flightPathCache[cacheKey]) {
            this.flightPathCache[cacheKey].forEach(path => {
                if (!map.hasLayer(path)) {
                    // console.log('Adding path to map');
                    path.addTo(map);
                }
            });
        } else {
            appState.flightPathToggle === 'to' ? this.drawFlightPathsToDestination(iata, directFlights) : this.drawFlightPathsFromOrigin(iata, directFlights);
        }
    },
    
    drawFlightPathsFromOrigin(originIata, directFlights) {
        Object.values(directFlights).forEach(flights =>
            flights.forEach(flight => {
                if (flight.originAirport.iata_code === originIata) {
                    this.drawPaths(flight, originIata);
                }
            })
        );
    },

    drawFlightPathsToDestination(destinationIata, directFlights) {
        const destinationFlights = directFlights[destinationIata] || [];
        destinationFlights.forEach(flight => this.drawPaths(flight, destinationIata));
    },

    async drawFlightPathBetweenAirports(route, getAirportDataByIata) {
        this.clearFlightPaths();
        try {
            if (!route || !Array.isArray(route.segmentCosts)) {
                console.error('Invalid route data:', route);
                return;
            }

            const airportPromises = route.segmentCosts.map(segment => {
                return Promise.all([getAirportDataByIata(segment.from), getAirportDataByIata(segment.to)]);
            });

            const airportPairs = await Promise.all(airportPromises);
            airportPairs.forEach(([originAirport, destinationAirport], index) => {
                if (originAirport && destinationAirport) {
                    const flightSegment = {
                        originAirport: originAirport,
                        destinationAirport: destinationAirport,
                        price: route.segmentCosts[index].price
                    };

                    this.createFlightPath(originAirport, destinationAirport, flightSegment, 0);
                    flightList.addFlightDetailsToList(flightSegment, this.clearFlightPaths.bind(this));
                }
            });
        } catch (error) {
            console.error('Error in drawFlightPathBetweenAirports:', error);
        }
    },

    adjustLatLng(latLng) {
        var currentBounds = map.getBounds();
        var newLng = latLng.lng;

        while (newLng < currentBounds.getWest()) newLng += 360;
        while (newLng > currentBounds.getEast()) newLng -= 360;

        return L.latLng(latLng.lat, newLng);
    },
    
    createFlightPath(origin, destination, flight) {
        let flightId = `${flight.originAirport.iata_code}-${flight.destinationAirport.iata_code}`;
        if (this.flightPathCache[flightId]) {
            this.flightPathCache[flightId].forEach(path => {
                if (!map.hasLayer(path)) {
                    path.addTo(map);
                }
            });
            return;
        }
    
        const drawPath = (origin, destination, offset) => {
            const adjustedOrigin = L.latLng(origin.latitude, origin.longitude + offset);
            const adjustedDestination = L.latLng(destination.latitude, destination.longitude + offset);
    
            var geodesicLine = new L.Geodesic([adjustedOrigin, adjustedDestination], {
                weight: 1,
                opacity: 1,
                color: this.getColorBasedOnPrice(flight.price),
                wrap: false,
                zIndex: -1
            }).addTo(map);
    
            geodesicLine.flight = flight;
    
            geodesicLine.on('click', () => {
                if (flightList.isFlightListed(flight)) {
                    flightList.removeFlightFromList(flight);
                    this.clearFlightPaths();
                } else {
                    flightList.addFlightDetailsToList(flight, this.clearFlightPaths.bind(this));
                }
            });
    
            geodesicLine.on('mouseover', (e) => {
                L.popup()
                    .setLatLng(e.latlng)
                    .setContent(`Price: $${flight.price}`)
                    .openOn(map);
            });
    
            geodesicLine.on('mouseout', () => {
                map.closePopup();
            });
    
            this.currentLines.push(geodesicLine);
            if (!this.flightPathCache[flightId]) {
                this.flightPathCache[flightId] = [];
            }
            this.flightPathCache[flightId].push(geodesicLine);
        };
    
        // Draw path for each world copy
        const worldCopies = [-720, -360, 0, 360, 720]; // Adjust range based on your needs
        worldCopies.forEach(offset => {
            drawPath(origin, destination, offset);
        });
    },       

    clearFlightPaths() {
        this.currentLines.forEach(line => {
            let shouldRemove = true;
            appState.flights.forEach(flight => {
                let flightId = `${flight.originAirport.iata_code}-${flight.destinationAirport.iata_code}`;
                if (this.flightPathCache[flightId] && this.flightPathCache[flightId].includes(line)) {
                    shouldRemove = false;
                }
            });
            if (shouldRemove && map.hasLayer(line)) {
                map.removeLayer(line);
            }
        });
    
        // Reset currentLines array
        this.currentLines = this.currentLines.filter(line => {
            return appState.flights.some(flight => {
                let flightId = `${flight.originAirport.iata_code}-${flight.destinationAirport.iata_code}`;
                return this.flightPathCache[flightId] && this.flightPathCache[flightId].includes(line);
            });
        });
    
        // Clear cached paths not in the flights array
        Object.keys(this.flightPathCache).forEach(cacheKey => {
            let shouldRemove = true;
            appState.flights.forEach(flight => {
                let flightId = `${flight.originAirport.iata_code}-${flight.destinationAirport.iata_code}`;
                if (cacheKey === flightId) {
                    shouldRemove = false;
                }
            });
            if (shouldRemove) {
                this.flightPathCache[cacheKey].forEach(path => {
                    if (map.hasLayer(path)) {
                        map.removeLayer(path);
                    }
                });
                delete this.flightPathCache[cacheKey];
            }
        });
    },       
    
    drawPaths(flight) {
        // console.log('drawPaths: flight:', flight);
        this.createFlightPath(flight.originAirport, flight.destinationAirport, flight, 0);
    },       

    getColorBasedOnPrice(price) {
        if (price === null || price === undefined || isNaN(parseFloat(price))) {
            return 'grey';
        }
        price = parseFloat(price);
        return price < 100 ? '#0099ff' : price < 200 ? 'green' : price < 300 ? '#abb740' : price < 400 ? 'orange' : price < 500 ? '#da4500' : '#c32929';
    },

    adjustLongitude(longitude) {
        var currentBounds = map.getBounds();
        var newLng = longitude;

        while (newLng < currentBounds.getWest()) newLng += 360;
        while (newLng > currentBounds.getEast()) newLng -= 360;

        return newLng;
    },
};

export { pathDrawing };

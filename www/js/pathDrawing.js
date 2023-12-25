import { map } from './map.js';
import { flightList } from './flightList.js';

const pathDrawing = {
    currentLines: [],
    flightPathCache: {},

    drawFlightPaths(iata, flightsByDestination, toggleState) {
        this.clearFlightPaths();
        let cacheKey = toggleState + '_' + iata;
        if (this.flightPathCache[cacheKey]) {
            this.flightPathCache[cacheKey].forEach(path => {
                if (!map.hasLayer(path)) {
                    path.addTo(map);
                }
                if (!this.currentLines.includes(path)) {
                    this.currentLines.push(path);
                }
            });
        } else {
            toggleState === 'to' ? this.drawFlightPathsToDestination(iata, flightsByDestination) : this.drawFlightPathsFromOrigin(iata, flightsByDestination);
        }
    },

    drawFlightPathsFromOrigin(originIata, flightsByDestination) {
        console.log('drawFlightPathsFromOrigin originIata:', originIata, 'flightsByDestination:', flightsByDestination);
        Object.values(flightsByDestination).forEach(flights =>
            flights.forEach(flight => {
                if (flight.originAirport.iata_code === originIata) {
                    this.drawPaths(flight, originIata);
                }
            })
        );
    },

    drawFlightPathsToDestination(destinationIata, flightsByDestination) {
        const destinationFlights = flightsByDestination[destinationIata] || [];
        destinationFlights.forEach(flight => this.drawPaths(flight, destinationIata));
    },

    async drawFlightPathBetweenAirports(route, getAirportDataByIata) {
        console.log('drawFlightPathBetweenAirports route:', route);
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
    createFlightPath(origin, destination, flight, lngOffset) {
        let flightId = `${flight.originAirport.iata_code}-${flight.destinationAirport.iata_code}-${lngOffset}`;
        if (this.flightPathCache[flightId]) {
            return; // Path already exists, no need to create a new one
        }

        var adjustedOrigin = [origin.latitude, origin.longitude + lngOffset];
        var adjustedDestination = [destination.latitude, destination.longitude + lngOffset];

        var geodesicLine = new L.Geodesic([adjustedOrigin, adjustedDestination], {
            weight: 1,
            opacity: 1,
            color: this.getColorBasedOnPrice(flight.price),
            wrap: false
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

        // Load the plane icon
        var planeIcon = L.icon({
            iconUrl: '../assets/plane_icon.png',
            iconSize: [16, 16],
            iconAnchor: [8, 12]
        });

        // Replace arrow symbol with plane icon
        var planeSymbol = L.Symbol.marker({
            rotate: true,
            markerOptions: {
                icon: planeIcon
            }
        });

        // Update polylineDecorator with planeSymbol
        var decoratedLine = L.polylineDecorator(geodesicLine, {
            patterns: [
                {offset: '50%', repeat: 0, symbol: planeSymbol}
            ]
        }).addTo(map);

        this.currentLines.push(geodesicLine, decoratedLine);

        let destinationIata = flight.destinationAirport.iata_code;
        let originIata = flight.originAirport.iata_code;
        let cacheKey = this.toggleState + '_' + (this.toggleState === 'to' ? destinationIata : originIata);

        this.flightPathCache[cacheKey] = this.flightPathCache[cacheKey] || [];
        this.flightPathCache[cacheKey].push(geodesicLine, decoratedLine);

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
            flightList.addFlightDetailsToList(flight, this.clearFlightPaths.bind(this));
            this.clearFlightPaths();
        });

        geodesicLine.flight = flight;
        decoratedLine.flight = flight;

        this.currentLines.push(geodesicLine, decoratedLine);
        this.flightPathCache[flightId] = [geodesicLine, decoratedLine];
    },

    clearFlightPaths() {
        this.currentLines.forEach(line => {
            if (map.hasLayer(line)) {
                map.removeLayer(line);
            }
        });
        this.currentLines = [];
        this.flightPathCache = {}; // Clear the cache as well
    },

    drawPaths(flight) {
        this.createFlightPath(flight.originAirport, flight.destinationAirport, flight, 0);
        for (let offset = -720; offset <= 720; offset += 360) {
            if (offset !== 0) {
                this.createFlightPath(flight.originAirport, flight.destinationAirport, flight, offset);
            }
        }
    },

    getColorBasedOnPrice(price) {
        if (price === null || price === undefined || isNaN(parseFloat(price))) {
            return 'grey'; // Return grey for flights without price data
        }
        price = parseFloat(price);
        return price < 100 ? '#0099ff' : price < 200 ? 'green' : price < 300 ? '#abb740' : price < 400 ? 'orange' : price < 500 ? '#da4500' : '#c32929';
    }
};

export { pathDrawing };

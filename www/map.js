var map = L.map('map', { minZoom: 2, maxZoom: 19 }).setView([0, 0], 2);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

var blueDotIcon = L.divIcon({
    className: 'custom-div-icon',
    html: '<div style="background-color: blue; width: 5px; height: 5px; border-radius: 50%;"></div>',
    iconSize: [5, 5],
    iconAnchor: [2, 2]
});

var FlightMap = {
    markers: {},
    flightsByDestination: {},
    currentLines: [],

    plotFlightPaths: function() {
        fetch('http://localhost:3000/flights')
            .then(response => response.json())
            .then(data => {
                data.forEach(flight => {
                    this.addMarker(flight.originAirport);
                    this.addMarker(flight.destinationAirport);

                    let destIata = flight.destinationAirport.iata_code;
                    if (!this.flightsByDestination[destIata]) {
                        this.flightsByDestination[destIata] = [];
                    }
                    this.flightsByDestination[destIata].push(flight);
                });
            })
            .catch(error => console.error('Error:', error));
    },

    addMarker: function(airport) {
        let iata = airport.iata_code;
        if (this.markers[iata]) return;

        var latLng = L.latLng(airport.latitude, airport.longitude);
        var marker = L.marker(latLng, {icon: blueDotIcon}).addTo(map)
            .bindPopup(`<b>${airport.name}</b><br>${airport.city}, ${airport.country}`);

        marker.on('click', () => {
            this.drawFlightPathsToDestination(iata);
        });

        marker.on('mouseover', () => {
            this.drawFlightPathsToDestination(airport.iata_code);
        });
    
        // Optional: Clear paths when the mouse leaves the marker
        marker.on('mouseout', () => {
            this.clearFlightPaths();
        });

        this.markers[iata] = marker;
    },

    drawFlightPathsToDestination: function(destinationIata) {
        this.clearFlightPaths();
        var destinationFlights = this.flightsByDestination[destinationIata];
        if (!destinationFlights) return;

        destinationFlights.forEach(flight => {
            var origin = flight.originAirport;
            var destination = flight.destinationAirport;

            // Draw original flight path
            this.createFlightPath(origin, destination, flight, 0);

            // Draw additional flight paths for each repeated map tile
            for (let offset = -720; offset <= 720; offset += 360) {
                if (offset !== 0) { // Avoid duplicating the original path
                    this.createFlightPath(origin, destination, flight, offset);
                }
            }
        });
    },

    createFlightPath: function(origin, destination, flight, lngOffset) {
        var adjustedOrigin = [origin.latitude, origin.longitude + lngOffset];
        var adjustedDestination = [destination.latitude, destination.longitude + lngOffset];

        var geodesicLine = new L.Geodesic([adjustedOrigin, adjustedDestination], {
            weight: 1,
            opacity: 1,
            color: this.getColorBasedOnPrice(flight.price),
            wrap: false
        }).addTo(map);

        this.currentLines.push(geodesicLine);
    },

    clearFlightPaths: function() {
        this.currentLines.forEach(line => map.removeLayer(line));
        this.currentLines = [];
    },

    getColorBasedOnPrice: function(price) {
        price = parseFloat(price);
        return price < 200 ? 'green' : price < 500 ? 'blue' : 'red';
    },

    redrawMarkers: function() {
        Object.values(this.markers).forEach(marker => {
            var newLatLng = this.adjustLatLng(marker.getLatLng());
            marker.setLatLng(newLatLng);
        });
    },

    adjustLatLng: function(latLng) {
        var currentBounds = map.getBounds();
        var newLng = latLng.lng;

        while (newLng < currentBounds.getWest()) newLng += 360;
        while (newLng > currentBounds.getEast()) newLng -= 360;

        return L.latLng(latLng.lat, newLng);
    }
};

map.on('moveend', function() {
    FlightMap.redrawMarkers();
});

FlightMap.plotFlightPaths();

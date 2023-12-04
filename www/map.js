var map = L.map('map', { minZoom: 2, maxZoom: 19 }).setView([0, 0], 2);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

var blueDotIcon = L.divIcon({
    className: 'custom-div-icon',
    html: '<div style="background-color: #3B74D5; width: 10px; height: 10px; border-radius: 50%;"></div>',
    iconSize: [10, 10],
    iconAnchor: [5, 5]
});

var FlightMap = {
    markers: {},
    flightsByDestination: {},
    currentLines: [],
    selectedMarker: null,

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
            if (this.selectedMarker) {
                this.clearFlightPaths(this.selectedMarker);
            }
            this.clearFlightPaths();
            this.selectedMarker = iata;
            this.drawFlightPathsToDestination(iata);
        });

        marker.on('mouseover', () => {
            if (this.selectedMarker !== iata) {
                this.drawFlightPathsToDestination(iata);
            }
        });

        marker.on('mouseout', () => {
            if (this.selectedMarker !== iata) {
                this.clearFlightPaths();
                if (this.selectedMarker) {
                    this.drawFlightPathsToDestination(this.selectedMarker);
                }
            }
        });

        this.markers[iata] = marker;
    },

    drawFlightPathsToDestination: function(destinationIata) {
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
            weight: 3, // Increased from 1 to 3 for thicker lines
            opacity: 1,
            color: this.getColorBasedOnPrice(flight.price),
            wrap: false
        }).addTo(map);
    
        this.currentLines.push(geodesicLine);
    
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

        geodesicLine.on('click', () => {
            this.addFlightDetailsToList(flight);
        });
    
        return geodesicLine;
    },  

    clearFlightPaths: function(exceptIata = null) {
        this.currentLines.forEach(line => map.removeLayer(line));
        this.currentLines = [];
        if (exceptIata) {
            this.drawFlightPathsToDestination(exceptIata);
        }
    },

    getColorBasedOnPrice: function(price) {
        price = parseFloat(price);
        return price < 200 ? 'green' : price < 500 ? '#3B74D5' : '#c32929';
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
    },

    addFlightDetailsToList: function(flight) {
        var list = document.getElementById('flightDetailsList');
        var listItem = document.createElement('li');
        listItem.innerHTML = `${flight.originAirport.iata_code} to ${flight.destinationAirport.iata_code} - $${flight.price}`;
    
        var details = `${flight.originAirport.city}, ${flight.originAirport.country} - ${flight.destinationAirport.city}, ${flight.destinationAirport.country} - Price: $${flight.price}`;
        
        listItem.onmouseover = function(e) {
            var tooltip = document.createElement('div');
            tooltip.className = 'tooltip';
            tooltip.innerHTML = details;
            tooltip.style.left = e.pageX + 'px';
            tooltip.style.top = e.pageY + 'px';
            document.body.appendChild(tooltip);
        };
    
        listItem.onmouseout = function() {
            var tooltips = document.getElementsByClassName('tooltip');
            while (tooltips.length > 0) {
                tooltips[0].parentNode.removeChild(tooltips[0]);
            }
        };
    
        list.appendChild(listItem);
    }           
};

map.on('moveend', function() {
    FlightMap.redrawMarkers();
});

FlightMap.plotFlightPaths();

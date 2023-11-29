var map = L.map('map').setView([0, 0], 2); // Initialize map

// Add a base layer (OpenStreetMap tiles)
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Function to fetch flight data and plot routes
function plotFlightPaths() {
    fetch('http://44.199.76.209:3000/flights') // Adjust if your API endpoint is different
        .then(response => response.json())
        .then(data => {
            data.forEach(flight => {
                // Origin and destination coordinates
                var originLatLng = [flight.originAirport.latitude, flight.originAirport.longitude];
                var destinationLatLng = [flight.destinationAirport.latitude, flight.destinationAirport.longitude];

                // Create markers for each airport
                var originMarker = L.marker(originLatLng).addTo(map)
                    .bindPopup(`<b>${flight.originAirport.name}</b><br>${flight.originAirport.city}, ${flight.originAirport.country}`);
                var destinationMarker = L.marker(destinationLatLng).addTo(map)
                    .bindPopup(`<b>${flight.destinationAirport.name}</b><br>${flight.destinationAirport.city}, ${flight.destinationAirport.country}`);

                // Create a static curved line between origin and destination
                var latlngs = [originLatLng, destinationLatLng];
                var curvedLine = L.polyline(latlngs, {
                    color: getColorBasedOnPrice(flight.price),
                    weight: 1,
                    opacity: 1,
                    smoothFactor: 1
                }).addTo(map);
                curvedLine.bindPopup(`Flight from ${flight.originAirport.name} to ${flight.destinationAirport.name}<br>Price: $${flight.price}`);
            });
        })
        .catch(error => console.error('Error:', error));
}

// Function to determine line color based on price
function getColorBasedOnPrice(price) {
    price = parseFloat(price);
    if (price < 200) return 'green';
    if (price < 500) return 'blue';
    return 'red';
}

plotFlightPaths();

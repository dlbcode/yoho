var map = L.map('map', {
    minZoom: 2,
    maxZoom: 19
    }).setView([0, 0], 2); // Initialize map

// Add a base layer (OpenStreetMap tiles)
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Custom blue dot icon
var blueDotIcon = L.divIcon({
    className: 'custom-div-icon',
    html: '<div style="background-color: blue; width: 5px; height: 5px; border-radius: 50%;"></div>',
    iconSize: [5, 5],
    iconAnchor: [2, 2]
});

// Function to fetch flight data and plot routes
function plotFlightPaths() {
    fetch('http://localhost:3000/flights') // Adjust if your API endpoint is different
        .then(response => response.json())
        .then(data => {
            data.forEach(flight => {
                // Origin and destination coordinates
                var originLatLng = [flight.originAirport.latitude, flight.originAirport.longitude];
                var destinationLatLng = [flight.destinationAirport.latitude, flight.destinationAirport.longitude];

                // Create markers for each airport with the custom icon
                var originMarker = L.marker(originLatLng, {icon: blueDotIcon}).addTo(map)
                    .bindPopup(`<b>${flight.originAirport.name}</b><br>${flight.originAirport.city}, ${flight.originAirport.country}`);
                var destinationMarker = L.marker(destinationLatLng, {icon: blueDotIcon}).addTo(map)
                    .bindPopup(`<b>${flight.destinationAirport.name}</b><br>${flight.destinationAirport.city}, ${flight.destinationAirport.country}`);

                // Create a geodesic line between origin and destination
                var geodesicLine = new L.Geodesic([originLatLng, destinationLatLng], {
                    weight: 1,
                    opacity: 1,
                    color: getColorBasedOnPrice(flight.price)
                }).addTo(map);

                geodesicLine.bindPopup(`Flight from ${flight.originAirport.name} to ${flight.destinationAirport.name}<br>Price: $${flight.price}`);
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

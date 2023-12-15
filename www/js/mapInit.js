import { FlightMap } from './flightMap.js'; // Import FlightMap

var map = L.map('map', { minZoom: 2, maxZoom: 19 }).setView([0, 0], 2);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Event listener for zoom level change
map.on('zoomend', function() {
    var zoomLevel = map.getZoom();
    console.log('Map zoom level:', zoomLevel);
    FlightMap.updateMarkersForZoom();
});

export { map };

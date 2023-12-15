import { map } from './mapInit.js';
import { FlightMap } from './flightMap.js';

map.on('click', function() {
    FlightMap.clearFlightPaths();
    FlightMap.selectedMarker = null;
});

map.on('moveend', function() {
    FlightMap.redrawMarkers();
    FlightMap.updateVisibleMarkers(); // Call updateVisibleMarkers on map move
});

map.on('zoomend', function() {
    FlightMap.updateVisibleMarkers(); // Call updateVisibleMarkers on zoom change
});

document.getElementById('flightPathToggle').addEventListener('change', function() {
    FlightMap.toggleState = this.value;
    if (FlightMap.selectedMarker) {
        FlightMap.clearFlightPaths();
        FlightMap.drawFlightPaths(FlightMap.selectedMarker);
    }
});

document.getElementById('increaseTravelers').addEventListener('click', function() {
    var numTravelers = document.getElementById('numTravelers');
    numTravelers.value = parseInt(numTravelers.value, 10) + 1;
    FlightMap.updateTotalCost();
});

document.getElementById('decreaseTravelers').addEventListener('click', function() {
    var numTravelers = document.getElementById('numTravelers');
    if (numTravelers.value > 1) {
        numTravelers.value = parseInt(numTravelers.value, 10) - 1;
        FlightMap.updateTotalCost();
    }
});

document.addEventListener('zoomChanged', function() {
    FlightMap.updateMarkersForZoom();
});
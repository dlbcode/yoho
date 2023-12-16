import { map } from './mapInit.js';
import { flightMap } from './flightMap.js';
import { flightList } from './flightList.js';

map.on('click', function() {
    flightMap.clearFlightPaths();
    flightMap.selectedMarker = null;
});

map.on('moveend', function() {
    flightMap.redrawMarkers();
    flightMap.updateVisibleMarkers(); // Call updateVisibleMarkers on map move
});

map.on('zoomend', function() {
    flightMap.updateVisibleMarkers(); // Call updateVisibleMarkers on zoom change
});

document.getElementById('flightPathToggle').addEventListener('change', function() {
    flightMap.toggleState = this.value;
    if (flightMap.selectedMarker) {
        flightMap.clearFlightPaths();
        flightMap.drawFlightPaths(flightMap.selectedMarker);
    }
});

document.getElementById('increaseTravelers').addEventListener('click', function() {
    var numTravelers = document.getElementById('numTravelers');
    numTravelers.value = parseInt(numTravelers.value, 10) + 1;
    flightList.updateTotalCost();
});

document.getElementById('decreaseTravelers').addEventListener('click', function() {
    var numTravelers = document.getElementById('numTravelers');
    if (numTravelers.value > 1) {
        numTravelers.value = parseInt(numTravelers.value, 10) - 1;
        flightList.updateTotalCost();
    }
});

document.addEventListener('zoomChanged', function() {
    flightMap.updateMarkersForZoom();
});
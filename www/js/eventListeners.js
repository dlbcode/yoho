import { map } from './mapInit.js';
import { flightMap } from './flightMap.js';
import { flightList } from './flightList.js';

// Main function to set up map event listeners
function setupMapEventListeners() {
    map.on('click', () => {
        flightMap.clearFlightPaths();
        flightMap.selectedMarker = null;
    });

    map.on('moveend', () => {
        flightMap.redrawMarkers();
        flightMap.updateVisibleMarkers();
    });

    map.on('zoomend', () => {
        flightMap.updateVisibleMarkers();
    });
}

// Function to set up UI event listeners
function setupUIEventListeners() {
    const flightPathToggle = document.getElementById('flightPathToggle');
    flightPathToggle.addEventListener('change', function() {
        flightMap.toggleState = this.value;
        if (flightMap.selectedMarker) {
            flightMap.clearFlightPaths();
            flightMap.drawFlightPaths(flightMap.selectedMarker);
        }
    });

    const increaseTravelers = document.getElementById('increaseTravelers');
    increaseTravelers.addEventListener('click', function() {
        var numTravelers = document.getElementById('numTravelers');
        numTravelers.value = parseInt(numTravelers.value, 10) + 1;
        flightList.updateTotalCost();
    });

    const decreaseTravelers = document.getElementById('decreaseTravelers');
    decreaseTravelers.addEventListener('click', function() {
        var numTravelers = document.getElementById('numTravelers');
        if (numTravelers.value > 1) {
            numTravelers.value = parseInt(numTravelers.value, 10) - 1;
            flightList.updateTotalCost();
        }
    });

    document.addEventListener('zoomChanged', function() {
        flightMap.updateMarkersForZoom();
    });
}

// Initialize all event listeners after the DOM content is fully loaded
document.addEventListener('DOMContentLoaded', function() {
    setupMapEventListeners();
    setupUIEventListeners();
});

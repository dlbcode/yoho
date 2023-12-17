import { map } from './mapInit.js';
import { flightMap } from './flightMap.js';
import { flightList } from './flightList.js';
import { getIataFromField } from './airportAutocomplete.js';

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

// Function to attach event listeners to markers
function attachMarkerEventListeners(iata, marker) {
    marker.on('click', () => flightMap.markerClickHandler(iata));
    marker.on('mouseover', () => flightMap.markerHoverHandler(iata, 'mouseover'));
    marker.on('mouseout', () => flightMap.markerHoverHandler(iata, 'mouseout'));
}

// Function to handle custom events
function emitCustomEvent(eventName, data) {
    switch (eventName) {
        case 'markerCreated':
            attachMarkerEventListeners(data.iata, data.marker);
            break;
        // Add cases for other custom events if needed
    }
}

function setupAirportFieldListeners() {
    const fromAirportField = document.getElementById('fromAirport');
    const toAirportField = document.getElementById('toAirport');

    fromAirportField.addEventListener('change', function() {
        if (this.value && !toAirportField.value) {
            const iataCode = getIataFromField('fromAirport'); // Pass the ID, not the value
            if (iataCode) {
                flightMap.markerClickHandler(iataCode, true);
            }
        }
    });    
}

// Initialize all event listeners after the DOM content is fully loaded
document.addEventListener('DOMContentLoaded', function() {
    setupMapEventListeners();
    setupUIEventListeners();
    setupAirportFieldListeners();
});

window.addEventListener('resize', function() {
    var height = window.innerHeight;
    document.getElementById('map').style.height = height + 'px';
  });

// Exporting the custom event function
export { emitCustomEvent };

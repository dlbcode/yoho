import { map } from './map.js';
import { flightMap } from './flightMap.js';
import { pathDrawing } from './pathDrawing.js';
import { flightList } from './flightList.js';
import { getIataFromField } from './airportAutocomplete.js';
import { drawAllFlightPaths } from './allPaths.js';

let selectedFromAirport = null;
let selectedToAirport = null;

// Main function to set up map event listeners
function setupMapEventListeners() {
    map.on('click', () => {
        pathDrawing.clearFlightPaths();
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
            pathDrawing.clearFlightPaths();
            pathDrawing.drawFlightPaths(flightMap.selectedMarker);
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

function attachMarkerEventListeners(iata, marker, airport) {
    marker.on('mouseover', () => flightMap.markerHoverHandler(iata, 'mouseover'));
    marker.on('mouseout', () => flightMap.markerHoverHandler(iata, 'mouseout'));
    marker.on('click', () => {
        flightMap.handleMarkerClick(airport, marker); // Pass the correct airport data
    });
}

// Function to handle custom events
function emitCustomEvent(eventName, data) {
    switch (eventName) {
        case 'markerCreated':
            attachMarkerEventListeners(data.iata, data.marker, data.airport); // Pass the airport data
            break;
    }
}

function setupAirportFieldListeners() {
    const airportFields = document.querySelectorAll('#fromAirport, #toAirport');

    airportFields.forEach(field => {
        field.addEventListener('airportSelected', async function(event) {
            const fromAirportValue = getIataFromField('fromAirport');
            const toAirportValue = getIataFromField('toAirport');

            selectedFromAirport = fromAirportValue;
            selectedToAirport = toAirportValue;

            if (fromAirportValue && toAirportValue) {
                // Both fields are filled, fetch the cheapest routes and draw path
                flightMap.clearMultiHopPaths = false;
                fetch(`http://yonderhop.com:3000/cheapest-routes?origin=${fromAirportValue}&destination=${toAirportValue}`)
                .then(response => response.json())
                .then(routes => {
                    console.log('API Response:', routes);
                    if (routes.length > 0) {
                        const cheapestRoute = routes[0];
                        flightMap.drawFlightPathBetweenAirports(cheapestRoute);
                    }
                })
                .catch(error => console.error('Error fetching cheapest routes:', error));
            } else if (fromAirportValue || toAirportValue) {
                // Only one field is filled, set the toggle state and draw paths
                flightMap.toggleState = fromAirportValue ? 'from' : 'to';
                flightPathToggle.value = fromAirportValue ? 'from' : 'to';
                const selectedIata = fromAirportValue || toAirportValue;
                pathDrawing.clearFlightPaths();
                flightMap.drawFlightPaths(selectedIata);
            } else {
                // No fields are filled, clear paths
                flightMap.clearMultiHopPaths = true;
                pathDrawing.clearFlightPaths();
            }
        });
    });
}

function setupAllPathsButtonEventListener() {
    const allPathsButton = document.getElementById('allPathsBtn');
    if (allPathsButton) {
        allPathsButton.addEventListener('click', function() {
            drawAllFlightPaths(); // Call the function to draw all flight paths
        });
    }
}

var clearButton = document.getElementById('clearBtn');
clearButton.addEventListener('click', function() {
    flightList.clearFlightList();
    pathDrawing.clearFlightPaths();
});

// Initialize all event listeners after the DOM content is fully loaded
document.addEventListener('DOMContentLoaded', function() {
    setupMapEventListeners();
    setupUIEventListeners();
    setupAirportFieldListeners();
    setupAllPathsButtonEventListener();
});

window.addEventListener('resize', function() {
    var height = window.innerHeight;
    document.getElementById('map').style.height = height + 'px';
});

// Exporting the custom event function
export { emitCustomEvent, selectedFromAirport, selectedToAirport };

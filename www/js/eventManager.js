// eventManager.js
import { map } from './map.js';
import { flightMap } from './flightMap.js';
import { flightList } from './flightList.js';
import { pathDrawing } from './pathDrawing.js';
import { getIataFromField } from './airportAutocomplete.js';
import { drawAllFlightPaths } from './allPaths.js';

const eventManager = {
    setupEventListeners: function () {
        this.setupMapEventListeners();
        this.setupUIEventListeners();
        this.setupAirportFieldListeners();
        this.setupAllPathsButtonEventListener();
    },

    setupMapEventListeners: function () {
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
    },

    setupUIEventListeners: function () {
        const flightPathToggle = document.getElementById('flightPathToggle');
        flightPathToggle.addEventListener('change', function () {
            flightMap.toggleState = this.value;
            if (flightMap.selectedMarker) {
                pathDrawing.clearFlightPaths();
                pathDrawing.drawFlightPaths(flightMap.selectedMarker);
            }
        });

        const increaseTravelers = document.getElementById('increaseTravelers');
        increaseTravelers.addEventListener('click', function () {
            const numTravelers = document.getElementById('numTravelers');
            numTravelers.value = parseInt(numTravelers.value, 10) + 1;
            flightList.updateTotalCost();
        });

        const decreaseTravelers = document.getElementById('decreaseTravelers');
        decreaseTravelers.addEventListener('click', function () {
            const numTravelers = document.getElementById('numTravelers');
            if (numTravelers.value > 1) {
                numTravelers.value = parseInt(numTravelers.value, 10) - 1;
                flightList.updateTotalCost();
            }
        });

        // Assuming you have a flightMap object, you should use it here
        map.addEventListener('zoomChanged', function () {
            flightMap.updateMarkersForZoom();
        });
    },

    setupAirportFieldListeners: function () {
        const airportFields = document.querySelectorAll('#fromAirport, #toAirport');

        airportFields.forEach((field) => {
            field.addEventListener('airportSelected', async function (event) {
                const fromAirportValue = getIataFromField('fromAirport');
                const toAirportValue = getIataFromField('toAirport');
                
                if (fromAirportValue && toAirportValue) {
                    // Both fields are filled, fetch the cheapest routes and draw path
                    flightMap.clearMultiHopPaths = false;
                    try {
                        const response = await fetch(`http://yonderhop.com:3000/cheapest-routes?origin=${fromAirportValue}&destination=${toAirportValue}`);
                        const routes = await response.json();
                        if (routes.length > 0) {
                            const cheapestRoute = routes[0];
                            flightMap.drawFlightPathBetweenAirports(cheapestRoute);
                        }
                    } catch (error) {
                        console.error('Error fetching cheapest routes:', error);
                    }
                } else if (fromAirportValue || toAirportValue) {
                    // Only one field is filled, set the toggle state and draw paths
                    flightMap.toggleState = fromAirportValue ? 'from' : 'to';
                    flightPathToggle.value = fromAirportValue ? 'from' : 'to';
                    const selectedIata = fromAirportValue || toAirportValue;
                    pathDrawing.clearFlightPaths();
                    pathDrawing.drawFlightPaths(selectedIata);
                } else {
                    // No fields are filled, clear paths
                    flightMap.clearMultiHopPaths = true;
                    pathDrawing.clearFlightPaths();
                }
            });
        });
    },

    setupAllPathsButtonEventListener: function () {
        const allPathsButton = document.getElementById('allPathsBtn');
        if (allPathsButton) {
            allPathsButton.addEventListener('click', function () {
                drawAllFlightPaths();
            });
        }
    },

    attachMarkerEventListeners: function (iata, marker, airport) {
        marker.on('mouseover', () => flightMap.markerHoverHandler(iata, 'mouseover'));
        marker.on('mouseout', () => flightMap.markerHoverHandler(iata, 'mouseout'));
        marker.on('click', () => {
            flightMap.handleMarkerClick(airport, marker);
        });
    },

    emitCustomEvent: function (eventName, data) {
        switch (eventName) {
            case 'markerCreated':
                this.attachMarkerEventListeners(data.iata, data.marker, data.airport);
                break;
        }
    },
};

// Additional event handling logic

document.addEventListener('flightAdded', function (event) {
    const flight = event.detail;
    pathDrawing.clearFlightPaths();
    pathDrawing.createFlightPath(flight.originAirport, flight.destinationAirport, flight, 0);
});

const clearButton = document.getElementById('clearBtn');
clearButton.addEventListener('click', function () {
    flightList.clearFlightList();
    pathDrawing.clearFlightPaths();
});

window.addEventListener('resize', function () {
    const height = window.innerHeight;
    document.getElementById('map').style.height = height + 'px';
});

// Initialize all event listeners after the DOM content is fully loaded
document.addEventListener('DOMContentLoaded', function () {
    eventManager.setupEventListeners();
});

export { eventManager };

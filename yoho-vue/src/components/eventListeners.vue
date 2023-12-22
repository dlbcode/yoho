<template>
  <!-- This component does not require a template as it's used for setting up event listeners -->
</template>

<script>
//import { map } from '@/www/js/map.js'; // Adjust the import path as needed
import { flightMap } from './flightMap.vue'; // Adjust the import path as needed
import { flightList } from './flightList.vue'; // Adjust the import path as needed
import { getIataFromField } from './airportAutocomplete'; // Adjust the import path as needed
import { drawAllFlightPaths } from './allPaths.vue'; // Adjust the import path as needed

export default {
  name: 'EventListeners',
  mounted() {
    this.setupMapEventListeners();
    this.setupUIEventListeners();
    this.setupAirportFieldListeners();
    this.setupAllPathsButtonEventListener();
  },
  beforeUnmount() {
    // Clean up global event listeners if any
  },
  methods: {
    setupMapEventListeners() {
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
    },

    setupUIEventListeners() {
      const flightPathToggle = document.getElementById('flightPathToggle');
      flightPathToggle && flightPathToggle.addEventListener('change', function() {
        flightMap.toggleState = this.value;
        if (flightMap.selectedMarker) {
          flightMap.clearFlightPaths();
          flightMap.drawFlightPaths(flightMap.selectedMarker);
        }
      });

      const increaseTravelers = document.getElementById('increaseTravelers');
      increaseTravelers && increaseTravelers.addEventListener('click', function() {
        var numTravelers = document.getElementById('numTravelers');
        numTravelers.value = parseInt(numTravelers.value, 10) + 1;
        flightList.updateTotalCost();
      });

      const decreaseTravelers = document.getElementById('decreaseTravelers');
      decreaseTravelers && decreaseTravelers.addEventListener('click', function() {
        var numTravelers = document.getElementById('numTravelers');
        if (numTravelers.value > 1) {
          numTravelers.value = parseInt(numTravelers.value, 10) - 1;
          flightList.updateTotalCost();
        }
      });

      document.addEventListener('zoomChanged', function() {
        flightMap.updateMarkersForZoom();
      });
    },

    attachMarkerEventListeners(iata, marker, airport) {
      marker.on('mouseover', () => flightMap.markerHoverHandler(iata, 'mouseover'));
      marker.on('mouseout', () => flightMap.markerHoverHandler(iata, 'mouseout'));
      marker.on('click', () => {
        flightMap.handleMarkerClick(airport, marker); // Pass the correct airport data
      });
    },

    emitCustomEvent(eventName, data) {
      switch (eventName) {
        case 'markerCreated':
          this.attachMarkerEventListeners(data.iata, data.marker, data.airport); // Pass the airport data
          break;
      }
    },

    setupAirportFieldListeners() {
      const airportFields = document.querySelectorAll('#fromAirport, #toAirport');

      airportFields.forEach(field => {
        field.addEventListener('airportSelected', async function(event) {
          const fromAirportValue = getIataFromField('fromAirport');
          const toAirportValue = getIataFromField('toAirport');

          if (fromAirportValue && toAirportValue) {
            // Both fields are filled, fetch the cheapest routes and draw path
            flightMap.clearMultiHopPaths = false;
            fetch(`http://localhost:3000/cheapest-routes?origin=${fromAirportValue}&destination=${toAirportValue}`)
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
            const selectedIata = fromAirportValue || toAirportValue;
            flightMap.clearFlightPaths();
            flightMap.drawFlightPaths(selectedIata);
          } else {
            // No fields are filled, clear paths
            flightMap.clearMultiHopPaths = true;
            flightMap.clearFlightPaths();
          }
        });
      });
    },

    setupAllPathsButtonEventListener() {
      const allPathsButton = document.getElementById('allPathsBtn');
      allPathsButton && allPathsButton.addEventListener('click', function() {
        drawAllFlightPaths(); // Call the function to draw all flight paths
      });
    }
  }
};
</script>

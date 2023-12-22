<template>
  <!-- Your template code goes here -->
</template>

<script>
import { flightMap } from './flightMap.vue';
import map from '../App.vue';

export default {
  name: 'airportAutocomplete',
  data() {
    return {
      fromAirport: '',
      toAirport: '',
      allPathsDrawn: false,
      flightDataCache: null,
    };
  },
  methods: {
    drawAllFlightPaths() {
      if (this.allPathsDrawn) {
        this.clearFlightPaths();
        this.allPathsDrawn = false;
      } else {
        if (this.flightDataCache) {
          this.flightDataCache.forEach(flight => this.drawFlightPath(flight));
          console.info('Flight data loaded from cache');
          this.allPathsDrawn = true;
        } else {
          fetch('http://localhost:3000/flights')
            .then(response => response.json())
            .then(flights => {
                this.flightDataCache = flights;
                flights.forEach(flight => {
                    if (!flight.originAirport || !flight.destinationAirport) {
                        console.info('Incomplete flight data:', flight);
                        return;
                    }
                    this.drawFlightPath(flight);
                    this.allPathsDrawn = true;
                });
                console.info('Flight data loaded from API');
            })
            .catch(error => console.error('Error fetching flights:', error));
        }
      }
    },

    drawFlightPath(flight) {
      const adjustedOrigin = [flight.originAirport.latitude, flight.originAirport.longitude];
      const adjustedDestination = [flight.destinationAirport.latitude, flight.destinationAirport.longitude];

      const geodesicLine = new L.Geodesic([adjustedOrigin, adjustedDestination], {
          weight: 1,
          opacity: 0.7,
          color: this.getColorBasedOnPrice(flight.price),
          wrap: false
      }).addTo(this.map);

      this.currentLines.push(geodesicLine);

      return geodesicLine;
    },
  },
};
</script>

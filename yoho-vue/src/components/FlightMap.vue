<template>
  <l-map 
    ref="map" 
    :zoom="4" 
    :center="[51.505, -0.09]" 
    style="height: 500px;"
    @update:center="centerUpdated"
    @update:zoom="zoomUpdated"
  >
    <l-tile-layer 
      url="https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png"
      :attribution="'Map data © <a href=\'https://openstreetmap.org\'>OpenStreetMap</a> contributors, © <a href=\'https://stadiamaps.com/\'>Stadia Maps</a>'"
    ></l-tile-layer>
    <l-marker 
      v-for="marker in markers" 
      :key="marker.iata_code" 
      :lat-lng="[marker.latitude, marker.longitude]"
    >
      <l-popup>{{ marker.popupContent }}</l-popup>
    </l-marker>
  </l-map>
</template>

<script>
import { LMap, LTileLayer, LMarker, LPopup } from '@vue-leaflet/vue-leaflet';
import 'leaflet/dist/leaflet.css';

export default {
  name: 'FlightMap',
  components: {
    LMap,
    LTileLayer,
    LMarker,
    LPopup
  },
  data() {
    return {
      markers: [],
      cachedFlights: null,
      lastFetchTime: null,
      cacheDuration: 60000, // 1 minute in milliseconds
    };
  },
  mounted() {
    this.fetchAndPlotAirports();
  },
  methods: {
    fetchAndPlotAirports() {
      const currentTime = new Date().getTime();
      if (this.cachedFlights && this.lastFetchTime && currentTime - this.lastFetchTime < this.cacheDuration) {
        this.markers = this.processFlightData(this.cachedFlights);
      } else {
        fetch('http://localhost:3000/flights')
          .then(response => response.json())
          .then(data => {
            this.cachedFlights = data;
            this.lastFetchTime = currentTime;
            this.markers = this.processFlightData(data);
          })
          .catch(error => console.error('Error:', error));
      }
    },
    processFlightData(data) {
      const newMarkers = [];
      const addedIataCodes = new Set(); // Set to track added IATA codes

      data.forEach(flight => {
        // Process origin airport
        if (flight.originAirport && !addedIataCodes.has(flight.originAirport.iata_code)) {
          newMarkers.push({
            ...flight.originAirport,
            popupContent: `<b>${flight.originAirport.name}</b><br>${flight.originAirport.city}, ${flight.originAirport.country}`
          });
          addedIataCodes.add(flight.originAirport.iata_code);
        }

        // Process destination airport
        if (flight.destinationAirport && !addedIataCodes.has(flight.destinationAirport.iata_code)) {
          newMarkers.push({
            ...flight.destinationAirport,
            popupContent: `<b>${flight.destinationAirport.name}</b><br>${flight.destinationAirport.city}, ${flight.destinationAirport.country}`
          });
          addedIataCodes.add(flight.destinationAirport.iata_code);
        }
      });

      this.markers = newMarkers;
      console.log('Processed Markers:', newMarkers); // Log processed markers
    },

    markerExists(iataCode) {
      return this.markers.some(marker => marker.iata_code === iataCode);
    },
  },
};
</script>

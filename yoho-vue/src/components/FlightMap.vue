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
  data.forEach(flight => {
    if (flight.originAirport && !this.markerExists(flight.originAirport.iata_code)) {
      newMarkers.push({
        ...flight.originAirport,
        popupContent: `<b>${flight.originAirport.name}</b><br>${flight.originAirport.city}, ${flight.originAirport.country}`
      });
    }
    if (flight.destinationAirport && !this.markerExists(flight.destinationAirport.iata_code)) {
      newMarkers.push({
        ...flight.destinationAirport,
        popupContent: `<b>${flight.destinationAirport.name}</b><br>${flight.destinationAirport.city}, ${flight.destinationAirport.country}`
      });
    }
  });
  this.markers = newMarkers;
},
markerExists(iataCode) {
  return this.markers.some(marker => marker.iata_code === iataCode);
},
    // Assuming this method is causing the 'L is not defined' error
    addOrUpdateMarker(airport) {
      if (!airport || !airport.iata_code) {
        return;
      }

      // Check if the marker already exists
      const existingMarker = this.markers.find(m => m.iata_code === airport.iata_code);
      if (existingMarker) {
        // Update existing marker data
        existingMarker.latitude = airport.latitude;
        existingMarker.longitude = airport.longitude;
      } else {
        // Add new marker data
        this.markers.push({
          ...airport,
          popupContent: `<b>${airport.name}</b><br>${airport.city}, ${airport.country}`
        });
      }
    },
  },
};
</script>

<style>
#flightMap {
  height: 100%;
}
</style>

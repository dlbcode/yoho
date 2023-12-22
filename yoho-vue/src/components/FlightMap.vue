<template>
  <div id="flightMap" style="height: 500px;"></div>
</template>

<script>
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export default {
  name: 'FlightMap',
  data() {
    return {
      map: null,
      markers: {},
      cachedFlights: null,
      lastFetchTime: null,
      cacheDuration: 60000, // 1 minute in milliseconds
    };
  },
  mounted() {
    this.initMap();
    this.fetchAndPlotAirports();
  },
  methods: {
    initMap() {
      this.map = L.map('flightMap').setView([51.505, -0.09], 13);
      L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png', {
        attribution: 'Map data © <a href="https://openstreetmap.org">OpenStreetMap</a> contributors, © <a href="https://stadiamaps.com/">Stadia Maps</a>'
      }).addTo(this.map);
    },
    fetchAndPlotAirports() {
      const currentTime = new Date().getTime();
      if (this.cachedFlights && this.lastFetchTime && currentTime - this.lastFetchTime < this.cacheDuration) {
        this.processFlightData(this.cachedFlights);
      } else {
        fetch('http://localhost:3000/flights')
          .then(response => response.json())
          .then(data => {
            this.cachedFlights = data;
            this.lastFetchTime = currentTime;
            this.processFlightData(data);
          })
          .catch(error => console.error('Error:', error));
      }
    },
    processFlightData(data) {
      data.forEach(flight => {
        if (flight.originAirport) {
          this.addMarker(flight.originAirport);
        }
        if (flight.destinationAirport) {
          this.addMarker(flight.destinationAirport);
        }
      });
    },
    addMarker(airport) {
      if (!airport || !airport.iata_code || this.markers[airport.iata_code]) {
        return;
      }

      const latLng = L.latLng(airport.latitude, airport.longitude);
      const marker = L.marker(latLng).addTo(this.map)
        .bindPopup(`<b>${airport.name}</b><br>${airport.city}, ${airport.country}`);

      this.markers[airport.iata_code] = marker;
    },
  },
};
</script>

<style>
#flightMap {
  height: 100%;
}
</style>

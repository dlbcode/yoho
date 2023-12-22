<template>
  <div id="app">
    <!-- Use the components here as needed -->
    <!-- Example usage -->
    <FlightMap></FlightMap>
    <FlightList></FlightList>
    <AirportAutocomplete></AirportAutocomplete>
  </div>
</template>

<script>
import L from 'leaflet'; // Import Leaflet
import FlightMap from './components/flightMap.vue';
import FlightList from './components/flightList.vue';
import AirportAutocomplete from './components/airportAutocomplete.vue';
import EventListeners from './components/eventListeners.vue';

export default {
  name: 'App',
  components: {
    FlightMap,
    FlightList,
    AirportAutocomplete,
  },
  data() {
    return {
      map: null,
      blueDotIcon: null,
      magentaDotIcon: null,
    };
  },
  methods: {
    setupUIEventListeners() {
      // Logic for UI event listeners
    },
    drawPaths() {
      // Logic to draw paths
    },
    initializeMap() {
      // Initialize Leaflet map
      this.map = L.map('map', { zoomControl: false, minZoom: 2, maxZoom: 19 });
      this.map.setView([0, 0], 4);

      L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
      }).addTo(this.map);

      L.control.zoom({ position: 'bottomright' }).addTo(this.map);

      this.map.on('zoomend', () => {
        var zoomLevel = this.map.getZoom();
        console.log('Map zoom level:', zoomLevel);
        document.dispatchEvent(new CustomEvent('zoomChanged'));
      });

      // Initialize marker icons
      this.blueDotIcon = L.divIcon({
        className: 'custom-div-icon',
        html: '<div style="background-color: #3B74D5; width: 10px; height: 10px; border-radius: 50%;"></div>',
        iconSize: [10, 10],
        iconAnchor: [5, 5]
      });

      this.magentaDotIcon = L.divIcon({
        className: 'custom-div-icon',
        html: '<div style="background-color: #b43bd5; width: 10px; height: 10px; border-radius: 50%;"></div>',
        iconSize: [10, 10],
        iconAnchor: [5, 5]
      });

      // Fetch client's approximate location using IP-API
      fetch('http://ip-api.com/json/')
        .then(response => response.json())
        .then(data => {
          if (data.status === 'success') {
            this.map.setView([data.lat, data.lon], 4);
          } else {
            console.error('IP Geolocation failed:', data.message);
          }
        })
        .catch(error => {
          console.error('Error fetching IP Geolocation:', error);
        });
    },
  },
  mounted() {
    this.initializeMap();
    this.setupUIEventListeners();
    setupMapEventListeners();
    setupUIEventListeners();
    setupAirportFieldListeners();
    setupAllPathsButtonEventListener();
  },
};
</script>

<style>
  /* Your CSS styles */
</style>
